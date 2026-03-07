import { NextRequest, NextResponse } from "next/server";
import { retrieveSharedAudio } from "@/lib/share-store";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { transcribeAudio } from "@/lib/elevenlabs";
import {
  createThread,
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";

/**
 * POST /api/share-target/process
 * 
 * Process a previously shared audio file:
 * 1. Retrieve from temp store
 * 2. Transcribe via ElevenLabs STT
 * 3. Route to existing client or auto-create new one
 * 4. Process note via Backboard
 * 
 * Body: { shareId: string, clientId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { shareId, clientId: requestedClientId, localTimestamp, timezone } = body;

    if (!shareId) {
      return NextResponse.json(
        { error: "Missing shareId" },
        { status: 400 }
      );
    }

    // 1. Retrieve the stored audio
    const entry = retrieveSharedAudio(shareId);
    if (!entry) {
      return NextResponse.json(
        { error: "Shared audio expired or not found. Please share the file again." },
        { status: 410 }
      );
    }

    // 2. Transcribe via ElevenLabs STT
    const audioBlob = new Blob([new Uint8Array(entry.file)], { type: entry.mimeType });
    const audioFile = new File([audioBlob], entry.filename, {
      type: entry.mimeType,
    });

    let transcript: string;
    try {
      const sttResult = await transcribeAudio(audioFile);
      transcript = sttResult.text;
    } catch (sttErr) {
      return NextResponse.json(
        {
          error: `Transcription failed: ${String(sttErr)}`,
          hint: "The audio file may be in an unsupported format or too short.",
        },
        { status: 502 }
      );
    }

    if (!transcript?.trim()) {
      return NextResponse.json(
        { error: "Transcription returned empty text. The audio may be silent or too short." },
        { status: 422 }
      );
    }

    const supabase = createAdminClient();
    let clientId = requestedClientId;

    // 3. Resolve client
    if (!clientId) {
      // Auto-detect: try extracting phone number
      const phoneRegex =
        /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/;
      const phoneMatch = transcript.match(phoneRegex);
      const detectedPhone = phoneMatch ? phoneMatch[0] : null;

      if (detectedPhone) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("phone", detectedPhone)
          .single();
        if (existing) clientId = existing.id;
      }

      // If still no client, auto-create
      if (!clientId) {
        const extractRes = await sendMessageWithModel(
          (await createThread()).thread_id,
          `Extract the full name of the client from this transcript. If no name is mentioned, respond ONLY with "Unknown Client". Transcript: ${transcript}`,
          GEMINI_FLASH_CONFIG,
          { memory: "Off" }
        );

        let newName = extractRes.content?.trim() || "Unknown Client";
        if (newName.length > 30) newName = "New Client";

        const { data: worker } = await supabase
          .from("users")
          .select("id")
          .eq("auth0_id", session.user.sub)
          .single();

        const thread = await createThread();
        const { data: newClient } = await supabase
          .from("clients")
          .insert({
            name: newName,
            phone: detectedPhone || null,
            backboard_thread_id: thread.thread_id,
            assigned_worker_id: worker?.id || null,
          })
          .select()
          .single();

        clientId = newClient?.id;
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Failed to resolve or create client" },
        { status: 400 }
      );
    }

    // 4. Get client and process note via Backboard
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (!client || !client.backboard_thread_id) {
      return NextResponse.json(
        { error: "Client missing or has no Backboard thread" },
        { status: 400 }
      );
    }

    const tsContext = localTimestamp ? `\nWorker's local date/time: ${localTimestamp}${timezone ? ` (${timezone})` : ""}. Use this date for the note, NOT UTC.\n` : "";
    const prompt = `You are a factual case-note extraction agent. Extract ONLY objective, verifiable facts from this transcript. NEVER infer emotions, motivations, or conditions unless explicitly stated. Report only what was directly observed, stated, or done. These notes may be subpoenaed — accuracy is legally critical.\n${tsContext}\nNew case note for ${client.name}:\n\n${transcript}\n\nRespond with a structured factual note: a 1-2 sentence summary (who, where, when, what), then bullet points of direct statements, observed conditions, actions taken, and follow-up commitments. Nothing more.`;
    const response = await sendMessageWithModel(
      client.backboard_thread_id,
      prompt,
      GEMINI_FLASH_CONFIG,
      { memory: "Auto" }
    );

    return NextResponse.json({
      success: true,
      clientId: client.id,
      clientName: client.name,
      note: response.content,
      transcript,
      isNewClient: !requestedClientId,
    });
  } catch (err) {
    console.error("[share-target/process] Error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
