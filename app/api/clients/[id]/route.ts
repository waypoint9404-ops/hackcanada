import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import { sendMessageWithModel, GEMINI_FLASH_CONFIG } from "@/lib/backboard";

/**
 * GET /api/clients/[id]
 * Fetch a single client by UUID.
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
      .select("*")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: error?.message ?? "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ client });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/clients/[id]
 * Update client fields (summary, tags, risk_level). Only the assigned worker can update.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const { data: worker } = await supabase
      .from("users")
      .select("id")
      .eq("auth0_id", session.user.sub)
      .single();

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const { data: client, error: fetchErr } = await supabase
      .from("clients")
      .select("id, assigned_worker_id, backboard_thread_id, name")
      .eq("id", id)
      .single();

    if (fetchErr || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.assigned_worker_id !== worker.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.summary === "string") updates.summary = body.summary;
    if (Array.isArray(body.tags)) updates.tags = body.tags;
    if (body.risk_level && ["LOW", "MED", "HIGH"].includes(body.risk_level)) {
      updates.risk_level = body.risk_level;
    }

    const { error: updateErr } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Sync the summary edit to Backboard so AI memory reflects the correction
    if (typeof body.summary === "string" && client.backboard_thread_id) {
      try {
        await sendMessageWithModel(
          client.backboard_thread_id,
          `[WORKER EDIT — Summary — ${new Date().toISOString()}]\nThe social worker has manually corrected the case summary for ${client.name}:\n\n${body.summary}\n\nPlease acknowledge and update your understanding accordingly.`,
          GEMINI_FLASH_CONFIG,
          { memory: "Auto" }
        );
      } catch {
        // Backboard sync is best-effort; Supabase is the source of truth for summary
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete a client record. Only the assigned worker can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    // Verify the logged-in worker owns this client
    const { data: worker } = await supabase
      .from("users")
      .select("id")
      .eq("auth0_id", session.user.sub)
      .single();

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const { data: client, error: fetchErr } = await supabase
      .from("clients")
      .select("id, assigned_worker_id")
      .eq("id", id)
      .single();

    if (fetchErr || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.assigned_worker_id !== worker.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: deleteErr } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
