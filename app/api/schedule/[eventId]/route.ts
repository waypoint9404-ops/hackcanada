/**
 * GET    /api/schedule/[eventId] — Fetch single event
 * PATCH  /api/schedule/[eventId] — Update event (+ sync to GCal)
 * DELETE /api/schedule/[eventId] — Delete event (+ remove from GCal)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkerId } from "@/lib/user-sync";
import { updateGCalEvent, deleteGCalEvent } from "@/lib/google-calendar";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    const supabase = createAdminClient();

    const { data: event, error } = await supabase
      .from("schedule_events")
      .select("*, clients(id, name, risk_level)")
      .eq("id", eventId)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const { eventId } = await params;
    const body = await request.json();

    const supabase = createAdminClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("schedule_events")
      .select("*")
      .eq("id", eventId)
      .eq("worker_id", workerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Event not found or not yours" }, { status: 404 });
    }

    // Build update
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.all_day !== undefined) updates.all_day = body.all_day;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.client_id !== undefined) updates.client_id = body.client_id || null;

    const { data: event, error } = await supabase
      .from("schedule_events")
      .update(updates)
      .eq("id", eventId)
      .select("*, clients(id, name, risk_level)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync to Google Calendar if connected
    if (existing.google_event_id) {
      await updateGCalEvent(workerId, existing.google_event_id, {
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        all_day: event.all_day,
      });
    }

    return NextResponse.json({ success: true, event });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const { eventId } = await params;

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("schedule_events")
      .select("id, google_event_id")
      .eq("id", eventId)
      .eq("worker_id", workerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Delete from Google Calendar if synced
    if (existing.google_event_id) {
      await deleteGCalEvent(workerId, existing.google_event_id);
    }

    const { error } = await supabase
      .from("schedule_events")
      .delete()
      .eq("id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
