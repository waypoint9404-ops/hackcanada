/**
 * GET /api/itinerary/today
 *
 * Returns today's appointments for the authenticated worker, with joined client data.
 *
 * Query params:
 *   - timezone: IANA timezone string (default: "America/Toronto")
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const tz = request.nextUrl.searchParams.get("timezone") || "America/Toronto";

    // Compute today's start/end in the worker's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(now); // "YYYY-MM-DD"
    const startOfDay = new Date(`${todayStr}T00:00:00`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999`);

    const supabase = createAdminClient();

    // Fetch appointments for today
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("worker_id", workerId)
      .in("status", ["confirmed", "tentative"])
      .gte("starts_at", startOfDay.toISOString())
      .lte("starts_at", endOfDay.toISOString())
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[itinerary/today] Query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch client data for all appointments
    const clientIds = [...new Set((appointments || []).map((a) => a.client_id))];
    let clientMap: Record<string, { id: string; name: string; risk_level: string; tags: string[] }> = {};

    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, risk_level, tags")
        .in("id", clientIds);

      if (clients) {
        clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
      }
    }

    // Join client data into appointments
    const enriched = (appointments || []).map((appt) => ({
      ...appt,
      client: clientMap[appt.client_id] || { id: appt.client_id, name: "Unknown", risk_level: "LOW", tags: [] },
    }));

    return NextResponse.json({
      appointments: enriched,
      date: todayStr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
