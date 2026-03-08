/**
 * GET  /api/schedule — List events for the logged-in worker.
 * POST /api/schedule — Create a new event.
 *
 * Query params (GET): start, end, status, clientId
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkerId } from "@/lib/user-sync";
import { createGCalEvent } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const { searchParams } = request.nextUrl;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");

    const supabase = createAdminClient();

    let query = supabase
      .from("schedule_events")
      .select("*, clients(id, name, risk_level)")
      .eq("worker_id", workerId)
      .order("start_time", { ascending: true });

    if (start) query = query.gte("start_time", start);
    if (end) query = query.lte("start_time", end);
    if (status) {
      if (status === "active") {
        // active = suggested + confirmed (not cancelled/completed)
        query = query.in("status", ["suggested", "confirmed"]);
      } else {
        query = query.eq("status", status);
      }
    }
    if (clientId) query = query.eq("client_id", clientId);

    const { data: events, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: events ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const body = await request.json();
    const { title, description, start_time, end_time, all_day, client_id, priority, syncToGoogle } = body;

    if (!title?.trim() || !start_time) {
      return NextResponse.json({ error: "Title and start_time are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Optionally sync to Google Calendar
    let googleEventId: string | null = null;
    if (syncToGoogle !== false) {
      googleEventId = await createGCalEvent(workerId, {
        title,
        description,
        start_time,
        end_time,
        all_day,
      });
    }

    const { data: event, error } = await supabase
      .from("schedule_events")
      .insert({
        worker_id: workerId,
        client_id: client_id || null,
        title: title.trim(),
        description: description?.trim() || null,
        start_time,
        end_time: end_time || null,
        all_day: all_day ?? false,
        status: "confirmed",
        source: "manual",
        priority: priority || "normal",
        google_event_id: googleEventId,
      })
      .select("*, clients(id, name, risk_level)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
