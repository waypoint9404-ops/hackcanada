import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getThreadMessages } from "@/lib/backboard";

/**
 * GET /api/clients/[id]/timeline
 * Fetch all Backboard messages for a client's thread, formatted as timeline events.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json({ events: [], message: "No thread yet" });
    }

    const messages = await getThreadMessages(client.backboard_thread_id);

    // Format messages as timeline events
    const events = messages.map((msg, idx) => ({
      id: msg.run_id ?? `msg-${idx}`,
      role: msg.role ?? "assistant",
      content: msg.content ?? "",
      timestamp: (msg as Record<string, unknown>).created_at as string | undefined,
      tokens: msg.total_tokens,
    }));

    // Merge any worker edits from Supabase over the original Backboard messages
    try {
      const { data: edits } = await supabase
        .from("note_edits")
        .select("message_id, edited_content")
        .eq("client_id", id);

      if (edits && edits.length > 0) {
        const editMap = new Map(edits.map((e) => [e.message_id, e.edited_content]));
        for (const event of events) {
          const override = editMap.get(event.id);
          if (override !== undefined) {
            event.content = override;
          }
        }
      }
    } catch {
      // note_edits table may not exist yet — serve raw Backboard messages
    }

    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
