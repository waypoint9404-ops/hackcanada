import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createThread,
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";

/**
 * POST /api/ingest
 *
 * Voice ingestion pipeline:
 * 1. Accepts { clientId, transcript }
 * 2. Looks up the client's backboard_thread_id in Supabase
 * 3. If no thread exists, creates one and writes it back to Supabase
 * 4. Sends the transcript to Backboard with memory: "Auto" using Gemini Flash
 * 5. Returns the AI-structured case note with model info
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, transcript } = body;

    if (!clientId || !transcript) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, transcript" },
        { status: 400 }
      );
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
        { error: `Client not found: ${fetchError?.message || "no match"}` },
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
