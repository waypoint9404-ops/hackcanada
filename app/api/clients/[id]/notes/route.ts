import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 15 });

/**
 * POST /api/clients/[id]/notes
 *
 * Save an edited note back to the Backboard thread.
 * This keeps Backboard's memory aligned with any worker edits.
 *
 * Body: { content: string, tags?: string[], risk_level?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { success } = limiter.check(request);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { content, tags, risk_level } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id, tags, risk_level")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json(
        { error: "No Backboard thread for this client" },
        { status: 400 }
      );
    }

    // Send the edited note to Backboard as a worker edit
    const editMessage = `[WORKER EDIT — ${new Date().toISOString()}]\nThe social worker has reviewed and edited the following case note for ${client.name}:\n\n${content}\n\nPlease acknowledge this edit and update your understanding of this client accordingly.`;

    const response = await sendMessageWithModel(
      client.backboard_thread_id,
      editMessage,
      GEMINI_FLASH_CONFIG,
      { memory: "Auto" }
    );

    // Update tags and risk_level in Supabase if provided
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (tags && Array.isArray(tags)) updates.tags = tags;
    if (risk_level && ["LOW", "MED", "HIGH"].includes(risk_level)) {
      updates.risk_level = risk_level;
    }

    await supabase.from("clients").update(updates).eq("id", id);

    return NextResponse.json({
      success: true,
      acknowledgment: response.content,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
