/**
 * POST /api/itinerary/briefing
 *
 * Generate an on-demand morning audio briefing for the authenticated worker.
 *
 * Flow:
 * 1. Fetch today's confirmed/tentative appointments
 * 2. Fetch top 2 triage suggestions
 * 3. Generate a natural-language briefing script via Backboard (Gemini Flash)
 * 4. Convert to speech via ElevenLabs TTS
 * 5. Return { audioBase64, briefingText, appointmentCount, suggestionCount }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";
import {
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
  createThread,
} from "@/lib/backboard";
import { generateSpeech } from "@/lib/elevenlabs";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 5 });

export async function POST(request: NextRequest) {
  const { success: rateLimitOk } = limiter.check(request);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const supabase = createAdminClient();

    // Get worker name
    const { data: worker } = await supabase
      .from("users")
      .select("name")
      .eq("id", workerId)
      .single();

    const workerName = worker?.name || "there";

    // Get timezone from body or default
    let tz = "America/Toronto";
    try {
      const body = await request.json();
      if (body.timezone) tz = body.timezone;
    } catch { /* no body, use default */ }

    // 1. Get today's appointments
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

    const { data: appointments } = await supabase
      .from("appointments")
      .select("*")
      .eq("worker_id", workerId)
      .in("status", ["confirmed", "tentative"])
      .gte("starts_at", startOfDay.toISOString())
      .lte("starts_at", endOfDay.toISOString())
      .order("starts_at", { ascending: true });

    // Get client names for appointments
    const clientIds = [...new Set((appointments || []).map((a) => a.client_id))];
    let clientMap: Record<string, { name: string; risk_level: string; tags: string[] }> = {};

    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, risk_level, tags")
        .in("id", clientIds);

      if (clients) {
        clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
      }
    }

    // Format appointments for prompt
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const formattedAppointments =
      (appointments || []).length > 0
        ? (appointments || [])
            .map((a) => {
              const client = clientMap[a.client_id];
              const time = timeFormatter.format(new Date(a.starts_at));
              return `- ${time}: ${client?.name || "Unknown"} — ${a.title}${a.location ? ` at ${a.location}` : ""}${client?.risk_level === "HIGH" ? " (HIGH RISK)" : ""}`;
            })
            .join("\n")
        : "No scheduled appointments today.";

    // 2. Get top triage suggestions (inline scoring, simplified)
    const { data: allClients } = await supabase
      .from("clients")
      .select("id, name, risk_level, tags, updated_at, summary")
      .eq("assigned_worker_id", workerId);

    const scheduledClientIds = new Set((appointments || []).map((a) => a.client_id));
    const riskScores: Record<string, number> = { HIGH: 30, MED: 15, LOW: 5 };

    const suggestions = (allClients || [])
      .filter((c) => !scheduledClientIds.has(c.id))
      .map((c) => {
        const daysSince = Math.floor(
          (now.getTime() - new Date(c.updated_at).getTime()) / (24 * 60 * 60 * 1000)
        );
        const score = Math.min(daysSince * 2, 40) + (riskScores[c.risk_level] ?? 5);
        return { ...c, score, daysSince };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const formattedSuggestions =
      suggestions.length > 0
        ? suggestions
            .map(
              (s) =>
                `- ${s.name} (Risk: ${s.risk_level}, ${s.daysSince} days since last contact)${s.summary ? `. Context: ${s.summary.slice(0, 200)}` : ""}`
            )
            .join("\n")
        : "All clients are up to date.";

    // 3. Generate briefing script via Backboard
    const briefingPrompt = `You are an AI assistant for a social worker named ${workerName}.
Write a concise, natural-sounding morning briefing (~150 words, about 60 seconds when read aloud) summarizing their schedule today and any urgent unscheduled client needs. Include safety warnings from client history. Speak as if briefing a trusted colleague. Use "you" for the worker.

Do NOT use bullet points, headers, or formatting — this will be read aloud as speech.
Do NOT hallucinate information not provided below.

Today's date: ${todayStr}

SCHEDULED APPOINTMENTS:
${formattedAppointments}

URGENT UNSCHEDULED NEEDS:
${formattedSuggestions}`;

    // Use an ephemeral thread (no persistent memory needed for briefings)
    const thread = await createThread();
    const bbResponse = await sendMessageWithModel(
      thread.thread_id,
      briefingPrompt,
      GEMINI_FLASH_CONFIG,
      { memory: "Off" }
    );

    const briefingText = bbResponse.content ?? "Unable to generate briefing at this time.";

    // 4. Convert to speech via ElevenLabs
    let audioBase64: string | null = null;
    let warning: string | null = null;

    try {
      const audioBuffer = await generateSpeech(briefingText);
      audioBase64 = audioBuffer.toString("base64");
    } catch (ttsErr: unknown) {
      const msg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
      console.warn("[briefing] ElevenLabs TTS failed:", msg);
      warning = "Audio generation failed: " + msg;
    }

    return NextResponse.json({
      success: true,
      audioBase64,
      briefingText,
      warning,
      appointmentCount: (appointments || []).length,
      suggestionCount: suggestions.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
