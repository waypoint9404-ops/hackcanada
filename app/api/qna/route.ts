import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";

/**
 * POST /api/qna
 *
 * Smart Q&A endpoint:
 * 1. Accepts { clientId, question }
 * 2. Looks up the client's backboard_thread_id in Supabase
 * 3. Sends the question to Backboard with memory: "Auto" using Gemini Flash
 * 4. Returns the AI answer with model info
 *
 * Uses Gemini Flash for quick Q&A. Can be upgraded to Gemini Pro
 * for deeper reasoning by swapping to GEMINI_PRO_CONFIG.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, question } = body;

    if (!clientId || !question) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, question" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Look up the client's thread
    const { data: client, error: fetchError } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id")
      .eq("id", clientId)
      .single();

    if (fetchError || !client) {
      return NextResponse.json(
        { error: `Client not found: ${fetchError?.message || "no match"}` },
        { status: 404 }
      );
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json(
        {
          error:
            "No Backboard thread exists for this client. Ingest a note first.",
        },
        { status: 400 }
      );
    }

    // Send the question to Backboard via Gemini Flash
    const response = await sendMessageWithModel(
      client.backboard_thread_id,
      `Question about ${client.name}: ${question}`,
      GEMINI_FLASH_CONFIG,
      { memory: "Auto" }
    );

    return NextResponse.json({
      success: true,
      clientId,
      clientName: client.name,
      question,
      answer: response.content,
      model: {
        provider: response.model_provider,
        name: response.model_name,
      },
      tokens: response.total_tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/qna] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
