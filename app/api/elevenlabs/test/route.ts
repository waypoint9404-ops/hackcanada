/**
 * GET /api/elevenlabs/test
 *
 * Smoke test for ElevenLabs integration.
 * 1. Generates a short TTS clip (proves API key + TTS pipeline works)
 * 2. Returns base64-encoded audio for playback in the test dashboard
 *
 * Rate-limited: caches the result for 60 s to avoid burning ElevenLabs quota.
 */

import { NextResponse } from "next/server";
import { generateSpeech } from "@/lib/elevenlabs";

// ─── Simple in-memory cache + rate limiter ───────────────────────────────────
let cachedResult: { json: Record<string, unknown>; ts: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds
let lastRequestTs = 0;
const MIN_INTERVAL_MS = 5_000; // at most 1 request per 5 s

export async function GET() {
  const now = Date.now();

  // Return cached result if still fresh
  if (cachedResult && now - cachedResult.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ...cachedResult.json, cached: true });
  }

  // Rate-limit: reject if called too soon after the last real request
  if (now - lastRequestTs < MIN_INTERVAL_MS) {
    return NextResponse.json(
      { success: false, error: "Rate limited — please wait a few seconds." },
      { status: 429 }
    );
  }
  lastRequestTs = now;

  try {
    // Generate a short test clip to verify the full TTS pipeline
    const testText =
      "Waypoint integration test. ElevenLabs connection verified.";
    const audioBuffer = await generateSpeech(testText);

    const json = {
      success: true,
      audioBase64: audioBuffer.toString("base64"),
      audioSizeBytes: audioBuffer.length,
      testText,
    };

    cachedResult = { json, ts: Date.now() };

    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
