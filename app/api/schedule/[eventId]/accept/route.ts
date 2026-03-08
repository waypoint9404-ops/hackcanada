/**
 * POST /api/schedule/[eventId]/accept
 *
 * Accept a suggested event → status becomes "confirmed".
 * Optionally syncs to Google Calendar.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkerId } from "@/lib/user-sync";
import { createGCalEvent } from "@/lib/google-calendar";

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

    // INTERCEPT HARDCODED AI EVENT 
    if (eventId === "hardcoded-kim-jin-event") {
      let googleEventId: string | null = null;
      try {
        googleEventId = await createGCalEvent(workerId, {
          title: "Meeting with Kim Jin",
          description: "Discuss case plan.",
          start_time: "2026-03-08T10:00:00.000Z",
          end_time: "2026-03-08T11:00:00.000Z",
          all_day: false,
          colorId: "9",
        });
      } catch {
        // Non-fatal — GCal sync is optional
      }

      // We'll actually INSERT it into the database right now to make it "confirmed" persistently
      const { data: inserted, error: insertError } = await supabase
        .from("schedule_events")
        .insert({
          worker_id: workerId,
          client_id: null, // Since we don't have real client ID for Kim Jin
          title: "Meeting with Kim Jin",
          description: "Discuss case plan.",
          start_time: "2026-03-08T10:00:00.000Z",
          end_time: "2026-03-08T11:00:00.000Z",
          all_day: false,
          status: "confirmed",
          source: "ai_extracted",
          google_event_id: googleEventId,
          priority: "normal"
        })
        .select()
        .single();
      
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, event: inserted });
    }

    const { data: event } = await supabase
      .from("schedule_events")
      .select("*")
      .eq("id", eventId)
      .eq("worker_id", workerId)
      .eq("status", "suggested")
      .single();

    if (!event) {
      return NextResponse.json({ error: "Suggested event not found" }, { status: 404 });
    }

    // Sync to Google Calendar — AI events use grape color (colorId 9)
    let googleEventId: string | null = null;
    try {
      googleEventId = await createGCalEvent(workerId, {
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        all_day: event.all_day,
        colorId: "9", // Grape — visually distinct for AI-extracted events
      });
    } catch {
      // Non-fatal — GCal sync is optional
    }

    const { data: updated, error } = await supabase
      .from("schedule_events")
      .update({
        status: "confirmed",
        google_event_id: googleEventId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .select("*, clients(id, name, risk_level)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
