/**
 * POST /api/transcribe
 *
 * Standalone audio transcription endpoint.
 *
 * Accepts multipart form data with an `audio` file field.
 * Returns the transcript text + word-level timing data.
 *
 * Used by the frontend to:
 * 1. Preview transcript before ingestion (worker can review/edit)
 * 2. Display real-time transcription progress
 *
 * For the "Record Visit" flow:
 *   MediaRecorder → Blob → POST /api/transcribe → review → POST /api/ingest
 */

import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/elevenlabs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing or invalid "audio" field. Send multipart form data with an audio file.',
        },
        { status: 400 }
      );
    }

    // Validate file size (max 25MB — ElevenLabs limit)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Audio file too large (${(audioFile.size / 1024 / 1024).toFixed(1)}MB). Maximum is 25MB.`,
        },
        { status: 413 }
      );
    }

    // Transcribe via ElevenLabs Scribe v1
    const result = await transcribeAudio(audioFile);

    return NextResponse.json({
      success: true,
      transcript: result.text,
      languageCode: result.languageCode,
      wordCount: result.words?.length ?? 0,
      words: result.words,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/transcribe] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
