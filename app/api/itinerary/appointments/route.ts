/**
 * POST /api/itinerary/appointments
 *
 * Create a new appointment (manual or programmatic).
 *
 * Body: {
 *   clientId: string,
 *   title: string,
 *   eventType: string,
 *   startsAt: string (ISO),
 *   endsAt?: string (ISO),
 *   location?: string,
 *   notes?: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const body = await request.json();
    const { clientId, title, eventType, startsAt, endsAt, location, notes } = body;

    if (!clientId || !title || !eventType || !startsAt) {
      return NextResponse.json(
        { error: "clientId, title, eventType, and startsAt are required" },
        { status: 400 }
      );
    }

    // Validate event type
    const validTypes = ["home_visit", "court", "medical", "phone_call", "office", "transport", "other"];
    if (!validTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify client belongs to this worker
    const { data: client } = await supabase
      .from("clients")
      .select("id, assigned_worker_id")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.assigned_worker_id && client.assigned_worker_id !== workerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Default end time: 1 hour after start
    const defaultEnd = new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        worker_id: workerId,
        client_id: clientId,
        title,
        event_type: eventType,
        starts_at: startsAt,
        ends_at: endsAt || defaultEnd,
        location: location || null,
        notes: notes || null,
        source: "manual",
        status: "confirmed",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
