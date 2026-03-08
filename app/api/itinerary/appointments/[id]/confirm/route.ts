/**
 * POST /api/itinerary/appointments/[id]/confirm
 * Quick action: set appointment status to 'confirmed'.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const { id } = await params;

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("appointments")
      .select("id, worker_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    if (existing.worker_id !== workerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ appointment });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
