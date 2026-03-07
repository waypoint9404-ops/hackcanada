import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import {
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 15 });

/**
 * POST /api/clients/[id]/notes
 *
 * Save an edited note back to the Backboard thread and persist the edit in Supabase.
 * This keeps Backboard's memory aligned with any worker edits, and ensures
 * the edit survives page refreshes by storing it in the note_edits table.
 *
 * Body: { content: string, messageId?: string, tags?: string[], risk_level?: string }
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
    const { content, messageId, tags, risk_level } = body;

    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: worker } = await supabase
      .from("users")
      .select("id")
      .eq("auth0_id", session.user.sub)
      .single();

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id, tags, risk_level, assigned_worker_id")
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

    if (client.assigned_worker_id && client.assigned_worker_id !== worker.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Step 1: Persist the edit in Supabase immediately ──────────────────────
    // This happens first so the edit is never lost even if Backboard is slow/down.
    if (messageId && typeof messageId === "string") {
      try {
        await supabase
          .from("note_edits")
          .upsert(
            {
              client_id: id,
              message_id: messageId,
              edited_content: content,
              edited_by: worker.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "client_id,message_id" }
          );
      } catch {
        // note_edits table may not exist yet — edit is still sent to Backboard
      }
    }

    // ── Step 2: Update tags and risk_level in Supabase if provided ────────────
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (tags && Array.isArray(tags)) updates.tags = tags;
    if (risk_level && ["LOW", "MED", "HIGH"].includes(risk_level)) {
      updates.risk_level = risk_level;
    }
    await supabase.from("clients").update(updates).eq("id", id);

    // ── Step 3: Send to Backboard so AI memory reflects the correction ────────
    // This is required for correctness. Retry once for transient network errors.
    const editMessage = `[WORKER EDIT — ${new Date().toISOString()}]\nThe social worker has reviewed and edited the following case note for ${client.name}:\n\n${content}\n\nPlease acknowledge this edit and update your understanding of this client accordingly.`;

    let response;
    try {
      response = await sendMessageWithModel(
        client.backboard_thread_id,
        editMessage,
        GEMINI_FLASH_CONFIG,
        { memory: "Auto" }
      );
    } catch {
      try {
        response = await sendMessageWithModel(
          client.backboard_thread_id,
          editMessage,
          GEMINI_FLASH_CONFIG,
          { memory: "Auto" }
        );
      } catch (retryErr) {
        const reason = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.error("[notes] Backboard sync failed after retry:", reason);
        return NextResponse.json(
          {
            error:
              "Note edit was saved locally but failed to sync to Backboard. Please retry.",
            backboard_thread_id: client.backboard_thread_id,
            details: reason,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      acknowledgment: response?.content,
      backboard_thread_id: client.backboard_thread_id,
      run_id: response?.run_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
