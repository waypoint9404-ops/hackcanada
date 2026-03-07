/**
 * GET /api/elevenlabs/test
 *
 * Smoke test for ElevenLabs integration.
 * 1. Generates a short TTS clip (proves API key + TTS pipeline works)
 * 2. Returns base64-encoded audio for playback in the test dashboard
 */

import { NextResponse } from "next/server";
import { generateSpeech } from "@/lib/elevenlabs";

export async function GET() {
  try {
    // Generate a short test clip to verify the full TTS pipeline
    const testText =
      "Waypoint integration test. ElevenLabs connection verified.";
    const audioBuffer = await generateSpeech(testText);

    return NextResponse.json({
      success: true,
      audioBase64: audioBuffer.toString("base64"),
      audioSizeBytes: audioBuffer.length,
      testText,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
