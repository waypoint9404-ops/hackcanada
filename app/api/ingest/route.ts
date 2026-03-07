import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createThread,
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";
import { transcribeAudio } from "@/lib/elevenlabs";

/**
 * POST /api/ingest
 *
 * Voice ingestion pipeline — accepts EITHER:
 *   A) JSON body: { clientId, transcript }                     — text already transcribed
 *   B) Multipart form: audio file + clientId                   — needs STT first
 *   C) JSON body: { clientId, audioBase64, audioMimeType }     — base64-encoded audio
 *
 * Pipeline:
 * 1. If audio provided → transcribe via ElevenLabs STT (Scribe v1)
 * 2. Look up client in Supabase → get/create Backboard thread
 * 3. Send transcript to Backboard via Gemini Flash for structured note generation
 * 4. Return structured case note with tags, risk level, and summary
 */
export async function POST(request: NextRequest) {
  try {
    let clientId: string;
    let transcript: string;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // ─── Path B: Multipart form with audio file ──────────────────
      const formData = await request.formData();
      clientId = formData.get("clientId") as string;
      const audioFile = formData.get("audio");

      if (!clientId) {
        return NextResponse.json(
          { success: false, error: "Missing required field: clientId" },
          { status: 400 }
        );
      }

      if (!audioFile || !(audioFile instanceof Blob)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing or invalid "audio" field in multipart form.',
          },
          { status: 400 }
        );
      }

      // Transcribe audio → text
      const sttResult = await transcribeAudio(audioFile);
      transcript = sttResult.text;

      if (!transcript || transcript.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Transcription returned empty text. Audio may be too short or unclear.",
          },
          { status: 422 }
        );
      }
    } else {
      // ─── Path A or C: JSON body ──────────────────────────────────
      const body = await request.json();
      clientId = body.clientId;

      if (!clientId) {
        return NextResponse.json(
          { success: false, error: "Missing required field: clientId" },
          { status: 400 }
        );
      }

      if (body.audioBase64) {
        // Path C: base64-encoded audio → decode → transcribe
        const audioBuffer = Buffer.from(body.audioBase64, "base64");
        const mimeType = body.audioMimeType || "audio/webm";
        const audioBlob = new Blob([audioBuffer], { type: mimeType });

        const sttResult = await transcribeAudio(audioBlob);
        transcript = sttResult.text;

        if (!transcript || transcript.trim().length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: "Transcription returned empty text. Audio may be too short or unclear.",
            },
            { status: 422 }
          );
        }
      } else if (body.transcript) {
        // Path A: text transcript provided directly
        transcript = body.transcript;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "Provide either 'transcript' (text), 'audioBase64' (base64 audio), or multipart 'audio' file.",
          },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    // Step 1: Look up the client
    const { data: client, error: fetchError } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id, tags, risk_level")
      .eq("id", clientId)
      .single();

    if (fetchError || !client) {
      return NextResponse.json(
        { success: false, error: `Client not found: ${fetchError?.message || "no match"}` },
        { status: 404 }
      );
    }

    // Step 2: Ensure a Backboard thread exists
    let threadId = client.backboard_thread_id;

    if (!threadId) {
      const thread = await createThread();
      threadId = thread.thread_id;

      // Write the thread_id back to Supabase
      const { error: updateError } = await supabase
        .from("clients")
        .update({ backboard_thread_id: threadId })
        .eq("id", clientId);

      if (updateError) {
        console.error(
          "[/api/ingest] Failed to save thread_id:",
          updateError.message
        );
      }
    }

    // Step 3: Send transcript to Backboard via Gemini Flash
    const prompt = `New case note for ${client.name}:\n\n${transcript}\n\nPlease process this note and respond with:\n1. A clean, structured case note\n2. Issue categories (HOUSING, MENTAL_HEALTH, SUBSTANCE_USE)\n3. Updated risk level (LOW, MED, HIGH)\n4. A 2-3 sentence actionable summary`;

    const response = await sendMessageWithModel(threadId, prompt, GEMINI_FLASH_CONFIG, {
      memory: "Auto",
    });

    return NextResponse.json({
      success: true,
      clientId,
      clientName: client.name,
      threadId,
      transcript,
      structuredNote: response.content,
      model: {
        provider: response.model_provider,
        name: response.model_name,
      },
      tokens: response.total_tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/ingest] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
