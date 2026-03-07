import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessageWithModel,
  GEMINI_PRO_CONFIG,
} from "@/lib/backboard";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 10 });

const SUMMARY_PROMPT = `You are Waypoint, a case management assistant for municipal social workers.
Based on everything you know about this client from all previous interactions:

Generate an **actionable summary** in exactly this format:
1. A 2-3 sentence overview of the client's CURRENT situation
2. Their current risk level (LOW / MED / HIGH) with a brief justification
3. 2-3 specific action items for the social worker's next visit

Be factual, concise, and objective. Use present tense. Do not speculate.`;

/**
 * GET /api/clients/[id]/summary
 * Ask Backboard for an up-to-date actionable summary of the client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { success } = limiter.check(request);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id, risk_level, tags, summary")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // If no thread, return the static summary from Supabase
    if (!client.backboard_thread_id) {
      return NextResponse.json({
        summary: client.summary ?? "No case history yet.",
        source: "static",
      });
    }

    // Ask Backboard for a live summary via the Pro model (deeper reasoning)
    const response = await sendMessageWithModel(
      client.backboard_thread_id,
      SUMMARY_PROMPT,
      GEMINI_PRO_CONFIG,
      { memory: "Readonly" }
    );

    const summaryText = response.content ?? "Unable to generate summary.";

    // Optionally update the cached summary in Supabase
    await supabase
      .from("clients")
      .update({ summary: summaryText, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      summary: summaryText,
      source: "backboard",
      model: response.model_name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
