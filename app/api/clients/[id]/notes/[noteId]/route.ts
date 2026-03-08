import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import { sendMessageWithModel, GEMINI_FLASH_CONFIG } from "@/lib/backboard";
import { regenerateSummary } from "@/lib/regenerate-summary";

/**
 * DELETE /api/clients/[id]/notes/[noteId]
 * Deletes an AI Note (message) from the Backboard thread.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId, noteId } = await params;
    const supabase = createAdminClient();

    // Verify worker owns this client
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
      .select("id, name, assigned_worker_id, backboard_thread_id")
      .eq("id", clientId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.assigned_worker_id && client.assigned_worker_id !== worker.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json(
        { error: "No Backboard thread for this client" },
        { status: 400 }
      );
    }

    // Since Backboard does not currently support deleting individual messages via API,
    // we use a "soft delete" by sending a corrective message to the thread.
    // We send a system-like message from the worker telling the AI to disregard the specified note.
    const threadId = client.backboard_thread_id;
    const clientName = client.name;

    // We can run this in the background
    void (async () => {
      const deleteMessageContent = `[WORKER EDIT — ${new Date().toISOString()}]\nThe social worker has decided to DELETE a previous case note (Message ID: ${noteId}) for ${clientName}. Please completely disregard that specific note from the client's case history moving forward.`;

      try {
        await sendMessageWithModel(
          threadId,
          deleteMessageContent,
          GEMINI_FLASH_CONFIG,
          { memory: "Auto" }
        );
      } catch (err) {
        console.error("[notes/delete/bg] Backboard sync failed:", err instanceof Error ? err.message : err);
      }

      try {
        await regenerateSummary(clientId, threadId);
      } catch (err) {
        console.error("[notes/delete/bg] Summary regeneration failed after deletion:", err);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
