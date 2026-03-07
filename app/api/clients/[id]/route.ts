import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";

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
