import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createThread,
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";
import { regenerateSummary } from "@/lib/regenerate-summary";
import { transcribeAudio } from "@/lib/elevenlabs";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";
import {
  parseAppointmentFromResponse,
  stripAppointmentBlock,
  insertExtractedAppointment,
} from "@/lib/extract-appointment";

/**
 * Extracts a phone number from text using regex to facilitate new client detection.
 */
function extractPhoneNumber(text: string): string | null {
  const phoneRegex = /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/;
  const match = text.match(phoneRegex);
  return match ? match[0] : null;
}

const NOTE_STRUCTURING_PROMPT = `You are a factual case-note extraction agent for a municipal social worker's records.

CRITICAL RULES — FOLLOW EXACTLY:
- Extract ONLY objective, verifiable facts from the transcript.
- Report only what was directly observed, stated, or done. Use language like "Client stated…", "Worker observed…", "Client was seen at…".
- NEVER infer, assume, or interpret emotional states, motivations, mental health conditions, or intentions unless the client or worker explicitly stated them.
- NEVER add information that is not present in the transcript. If something is unclear, omit it.
- Do NOT speculate, editorialize, or add recommendations. Recommendations are the social worker's job.
- Do NOT use phrases like "appeared to be", "seemed", "likely", "probably", or "may have".
- These notes may be subpoenaed. Accuracy and objectivity are legally critical.

FORMAT:
- Start with a 1-2 sentence factual summary of the visit/interaction (who, where, when, what).
- Follow with bullet points covering ONLY: direct client statements (quoted or paraphrased with attribution), observed physical conditions or environment, concrete actions taken by the worker, and any follow-up commitments made.
- Use professional, clinical, third-person language.
- Be concise — include all verifiable details, exclude everything else.
- Do NOT include the raw transcript itself.
- At the very end of your response, on a new line, output EXACTLY one of these risk tags: [RISK:LOW] [RISK:MED] [RISK:HIGH]
  Choose based on the factual severity: HIGH = immediate danger, legal jeopardy, or urgent medical need; MED = notable but non-urgent concerns; LOW = routine check-in with no red flags.

ADDITIONALLY: If the transcript contains ANY reference to a future meeting, appointment, follow-up, court date, or scheduled interaction, extract it as a structured block AFTER the risk tag in this exact format:
[NEXT_APPOINTMENT]{"date":"YYYY-MM-DD","time":"HH:MM","type":"<event_type>","description":"<short title>","location":"<place or null>"}[/NEXT_APPOINTMENT]
If no future appointment is mentioned, do NOT include this block.
Valid event_type values: home_visit, court, medical, phone_call, office, transport, other.
For relative dates like "Tuesday" or "next week", resolve them against the worker's local date/time provided in context.

Raw transcript:
`;

/**
 * POST /api/ingest
 * Fully enhanced ingestion pipeline with NEW CLIENT auto-detection.
 * After ingestion, triggers summary regeneration.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    let clientId: string | undefined;
    let transcript: string = "";
    let localTimestamp: string = "";
    let timezone: string = "";
    let body: any = null;
    const contentType = request.headers.get("content-type") ?? "";

    // 1. Extract audio/transcript and clientId
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      clientId = formData.get("clientId") as string | undefined;
      localTimestamp = (formData.get("localTimestamp") as string) || "";
      timezone = (formData.get("timezone") as string) || "";
      const audioFile = formData.get("audio");

      if (audioFile instanceof Blob) {
        try {
          const sttResult = await transcribeAudio(audioFile);
          transcript = sttResult.text;
        } catch (e) {
          return NextResponse.json({ success: false, error: `ElevenLabs STT Failed: ${String(e)}\nPlease use text upload fallback.` }, { status: 502 });
        }
      }
    } else {
      body = await request.json();
      clientId = body.clientId;
      localTimestamp = body.localTimestamp || "";
      timezone = body.timezone || "";
      if (body.transcript) {
        transcript = body.transcript;
      }
    }

    if (!transcript?.trim()) {
      return NextResponse.json({ success: false, error: "Empty transcript" }, { status: 422 });
    }

    const supabase = createAdminClient();

    // 2. NEW CLIENT AUTO-DETECTION MODE (if no clientId provided)
    if (!clientId) {
      const detectedPhone = extractPhoneNumber(transcript);
      
      if (detectedPhone) {
        // Try to find existing client by phone
        const { data: existing } = await supabase.from("clients").select("id").eq("phone", detectedPhone).single();
        if (existing) {
          clientId = existing.id;
        }
      }

      // Still no client found? Automatically create one!
      if (!clientId) {
        // Ask Backboard to extract a name from the text
        const extractRes = await sendMessageWithModel(
          (await createThread()).thread_id, 
          `Extract the full name of the client from this transcript. If no name is mentioned, respond ONLY with "Unknown Client". Transcript: ${transcript}`,
          GEMINI_FLASH_CONFIG, { memory: "Off" }
        );
        
        let newName = extractRes.content?.trim() || "Unknown Client";
        if (newName.length > 30) newName = "New Client"; // Safety check

        let workerId: string | null = null;
        if (session) {
          try {
            workerId = await getCurrentWorkerId(session.user.sub);
          } catch (e) {
            console.warn("Worker not found for auto-client creation:", session.user.sub);
          }
        }

        const thread = await createThread();
        const { data: newClient } = await supabase
          .from("clients")
          .insert({
            name: newName,
            phone: detectedPhone || null,
            backboard_thread_id: thread.thread_id,
            assigned_worker_id: workerId
          })
          .select()
          .single();

        clientId = newClient?.id;
      }
    }

    // Ensure we have a clientId now
    if (!clientId) return NextResponse.json({ error: "Failed to resolve clientId" }, { status: 400 });

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client || !client.backboard_thread_id) return NextResponse.json({ error: "Invalid client state" }, { status: 400 });

    // 3. Process Note via Backboard with refined prompt
    // Include the worker's local date/time so the AI uses correct timestamps
    const timestampContext = localTimestamp
      ? `\nWorker's local date/time: ${localTimestamp}${timezone ? ` (${timezone})` : ""}. Use this date for the note, NOT UTC.\n`
      : "";
    const prompt = `${NOTE_STRUCTURING_PROMPT}${timestampContext}${transcript}`;
    const response = await sendMessageWithModel(
      client.backboard_thread_id, 
      prompt, 
      GEMINI_FLASH_CONFIG, 
      { memory: "Auto" }
    );

    // 3b. Extract risk level from AI response and update client record
    const noteContent = response.content ?? "";
    const riskMatch = noteContent.match(/\[RISK:(LOW|MED|HIGH)\]/);
    const detectedRisk = riskMatch ? riskMatch[1] as "LOW" | "MED" | "HIGH" : null;

    if (detectedRisk) {
      await supabase
        .from("clients")
        .update({ risk_level: detectedRisk, updated_at: new Date().toISOString() })
        .eq("id", clientId);
    }

    // 3c. Extract appointment from AI response (non-blocking)
    let extractedAppointmentId: string | null = null;
    try {
      const extracted = parseAppointmentFromResponse(noteContent);
      if (extracted) {
        let workerId: string | null = null;
        if (session) {
          try { workerId = await getCurrentWorkerId(session.user.sub); } catch { /* skip */ }
        }
        if (workerId) {
          const appt = await insertExtractedAppointment(
            workerId, clientId!, extracted, response.run_id
          );
          extractedAppointmentId = appt?.id ?? null;
        }
      }
    } catch (apptErr) {
      console.error("[ingest] Appointment extraction failed (non-fatal):", apptErr);
    }

    // 4. Trigger summary regeneration (non-blocking error handling)
    try {
      await regenerateSummary(client.id, client.backboard_thread_id);
    } catch (summaryErr) {
      console.error("[ingest] Summary regeneration failed (non-fatal):", summaryErr);
    }

    return NextResponse.json({
      success: true,
      clientId: client.id,
      clientName: client.name,
      note: stripAppointmentBlock(noteContent.replace(/\[RISK:(LOW|MED|HIGH)\]/g, "")).trim(),
      rawTranscript: transcript,
      riskLevel: detectedRisk || client.risk_level,
      isNewClient: !request.headers.get("content-type")?.includes("multipart") && !body?.clientId,
      extractedAppointmentId,
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
