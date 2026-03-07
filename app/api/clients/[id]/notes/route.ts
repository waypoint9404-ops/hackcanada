import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import {
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";
import { regenerateSummary } from "@/lib/regenerate-summary";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 15 });

/**
 * POST /api/clients/[id]/notes
 * Save an edited note to Supabase immediately, then sync to Backboard and
 * regenerate the summary asynchronously via `after()` so the client gets a
 * fast response. The edit is persisted in note_edits first (never lost).
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

    const session = await auth0.getSession(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read body once defensively
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { content, messageId, tags, risk_level } = body as {
      content?: string;
      messageId?: string;
      tags?: string[];
      risk_level?: string;
    };

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

    // ── Step 3: Fire-and-forget Backboard sync + summary regen ─────────────
    // The edit is safely persisted in Supabase; return immediately.
    // Backboard memory sync and summary regen run in a detached promise —
    // avoids the "Response body object should not be disturbed or locked"
    // error caused by after() interfering with the response lifecycle.
    const threadId = client.backboard_thread_id!;
    const clientName = client.name;
    const clientId = id;
    const editedContent = content;

    void (async () => {
      const editMessage = `[WORKER EDIT — ${new Date().toISOString()}]\nThe social worker has reviewed and edited the following case note for ${clientName}:\n\n${editedContent}\n\nPlease acknowledge this edit and update your understanding of this client accordingly.`;

      try {
        await sendMessageWithModel(
          threadId,
          editMessage,
          GEMINI_FLASH_CONFIG,
          { memory: "Auto" }
        );
      } catch (err) {
        console.error("[notes/bg] Backboard sync failed:", err instanceof Error ? err.message : err);
      }

      try {
        await regenerateSummary(clientId, threadId);
      } catch (err) {
        console.error("[notes/bg] Summary regeneration failed:", err instanceof Error ? err.message : err);
      }
    })();

    return NextResponse.json({
      success: true,
      backboard_thread_id: client.backboard_thread_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
