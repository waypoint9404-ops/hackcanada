/**
 * GET /api/itinerary/suggestions
 *
 * Returns AI-ranked triage suggestions — clients who should be visited today.
 * Combines three signals:
 *   1. Days since last contact (updated_at)
 *   2. Client risk level
 *   3. Approaching appointment deadlines
 *
 * Excludes clients who already have appointments today.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";

interface TriageSuggestion {
  client: {
    id: string;
    name: string;
    risk_level: string;
    tags: string[];
    updated_at: string;
  };
  score: number;
  reasons: string[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const tz = request.nextUrl.searchParams.get("timezone") || "America/Toronto";
    const supabase = createAdminClient();

    // 1. Get all clients for this worker
    const { data: clients, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, risk_level, tags, updated_at")
      .eq("assigned_worker_id", workerId);

    if (clientErr || !clients) {
      return NextResponse.json({ error: clientErr?.message || "No clients found" }, { status: 500 });
    }

    // 2. Get today's appointments to exclude already-scheduled clients
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(now);
    const startOfDay = new Date(`${todayStr}T00:00:00`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999`);

    const { data: todayAppts } = await supabase
      .from("appointments")
      .select("client_id")
      .eq("worker_id", workerId)
      .in("status", ["confirmed", "tentative"])
      .gte("starts_at", startOfDay.toISOString())
      .lte("starts_at", endOfDay.toISOString());

    const scheduledClientIds = new Set((todayAppts || []).map((a) => a.client_id));

    // 3. Get upcoming appointments (next 7 days) for deadline scoring
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data: upcomingAppts } = await supabase
      .from("appointments")
      .select("client_id, starts_at")
      .eq("worker_id", workerId)
      .in("status", ["confirmed", "tentative"])
      .gte("starts_at", now.toISOString())
      .lte("starts_at", weekFromNow.toISOString());

    // Map client_id → earliest upcoming deadline
    const deadlineMap = new Map<string, number>();
    for (const appt of upcomingAppts || []) {
      const daysUntil = Math.ceil(
        (new Date(appt.starts_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      const existing = deadlineMap.get(appt.client_id);
      if (existing === undefined || daysUntil < existing) {
        deadlineMap.set(appt.client_id, daysUntil);
      }
    }

    // 4. Score and rank clients
    const riskScores: Record<string, number> = { HIGH: 30, MED: 15, LOW: 5 };

    const suggestions: TriageSuggestion[] = clients
      .filter((c) => !scheduledClientIds.has(c.id))
      .map((client) => {
        const reasons: string[] = [];

        // Days since last contact
        const daysSinceUpdate = Math.floor(
          (now.getTime() - new Date(client.updated_at).getTime()) / (24 * 60 * 60 * 1000)
        );
        const contactScore = Math.min(daysSinceUpdate * 2, 40);
        if (daysSinceUpdate >= 7) {
          reasons.push(`${daysSinceUpdate} days since last contact`);
        }

        // Risk level
        const riskScore = riskScores[client.risk_level] ?? 5;
        if (client.risk_level === "HIGH") {
          reasons.push("Risk level: HIGH");
        } else if (client.risk_level === "MED") {
          reasons.push("Risk level: MED");
        }

        // Approaching deadlines
        const daysUntilDeadline = deadlineMap.get(client.id);
        let deadlineScore = 0;
        if (daysUntilDeadline !== undefined) {
          deadlineScore = Math.max(0, 30 - daysUntilDeadline * 4);
          if (deadlineScore > 0) {
            reasons.push(
              `Deadline in ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""}`
            );
          }
        }

        const score = contactScore + riskScore + deadlineScore;

        return { client, score, reasons };
      })
      .filter((s) => s.reasons.length > 0) // Only suggest if there's a reason
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
