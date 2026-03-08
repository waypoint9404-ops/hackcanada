/**
 * POST /api/schedule/[eventId]/dismiss
 *
 * Dismiss a suggested event → status becomes "cancelled".
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkerId } from "@/lib/user-sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const { eventId } = await params;
    const supabase = createAdminClient();

    const { data: updated, error } = await supabase
      .from("schedule_events")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("worker_id", workerId)
      .eq("status", "suggested")
      .select("id")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: "Suggested event not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
