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

/**
 * Extracts a phone number from text using regex to facilitate new client detection.
 */
function extractPhoneNumber(text: string): string | null {
  const phoneRegex = /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/;
  const match = text.match(phoneRegex);
  return match ? match[0] : null;
}

const NOTE_STRUCTURING_PROMPT = `Transform this raw case note transcript into a structured, professional case note for a social worker's records.

FORMAT:
- Start with a 1-2 sentence summary of the visit/interaction
- Follow with bullet points covering: key client statements, observed conditions, actions taken, and recommended follow-ups
- Use professional, objective language
- Be concise but thorough — include all relevant details from the transcript
- Do NOT include the raw transcript itself

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
    let body: any = null;
    const contentType = request.headers.get("content-type") ?? "";

    // 1. Extract audio/transcript and clientId
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      clientId = formData.get("clientId") as string | undefined;
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

        const workerIds = session ? await supabase.from("users").select("id").eq("auth0_id", session.user.sub).single() : null;

        const thread = await createThread();
        const { data: newClient } = await supabase
          .from("clients")
          .insert({
            name: newName,
            phone: detectedPhone || null,
            backboard_thread_id: thread.thread_id,
            assigned_worker_id: workerIds?.data?.id || null
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
    const prompt = `${NOTE_STRUCTURING_PROMPT}${transcript}`;
    const response = await sendMessageWithModel(
      client.backboard_thread_id, 
      prompt, 
      GEMINI_FLASH_CONFIG, 
      { memory: "Auto" }
    );

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
      note: response.content,
      rawTranscript: transcript,
      isNewClient: !request.headers.get("content-type")?.includes("multipart") && !body?.clientId
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
