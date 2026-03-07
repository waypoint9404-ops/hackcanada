/**
 * POST /api/recap
 *
 * Generate a per-client audio recap.
 *
 * Flow:
 * 1. Look up client in Supabase → get backboard_thread_id
 * 2. Ask Backboard to generate a concise verbal summary (using Pro model for reasoning)
 * 3. Send summary text to ElevenLabs TTS
 * 4. Return audio as audio/mpeg stream
 *
 * Request body: { clientId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessageWithModel,
  GEMINI_PRO_CONFIG,
} from "@/lib/backboard";
import { generateSpeech } from "@/lib/elevenlabs";

const RECAP_PROMPT = `You are preparing a brief audio recap for a social worker who is about to visit this client. 
Generate a concise, factual summary (3-5 sentences max) covering:
1. Client's current situation and risk level
2. Most recent interactions or events
3. Key things the worker should be aware of for today's visit
4. Any immediate action items

Speak naturally as if briefing a colleague. Use first person ("you" for the worker). 
Do NOT include headers, bullet points, or formatting — this will be read aloud as speech.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    // Step 1: Look up client
    const supabase = createAdminClient();
    const { data: client, error: dbError } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id, risk_level, tags")
      .eq("id", clientId)
      .single();

    if (dbError || !client) {
      return NextResponse.json(
        { success: false, error: dbError?.message ?? "Client not found" },
        { status: 404 }
      );
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No Backboard thread for this client. Ingest at least one note first.",
        },
        { status: 400 }
      );
    }

    // Step 2: Ask Backboard for a verbal summary using the Pro model
    const backboardResponse = await sendMessageWithModel(
      client.backboard_thread_id,
      RECAP_PROMPT,
      GEMINI_PRO_CONFIG,
      { memory: "Readonly" }
    );

    const summaryText =
      backboardResponse.content ?? "No summary could be generated.";

    // Step 3: Convert to speech via ElevenLabs
    const audioBuffer = await generateSpeech(summaryText);

    // Step 4: Return audio response
    return new Response(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Content-Disposition": `inline; filename="recap-${client.name.replace(/\s+/g, "-").toLowerCase()}.mp3"`,
        "X-Recap-Text": encodeURIComponent(summaryText),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
