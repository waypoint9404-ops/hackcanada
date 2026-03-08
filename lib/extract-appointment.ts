/**
 * Appointment extraction utilities for the Smart Triage Itinerary.
 *
 * Parses [NEXT_APPOINTMENT]...[/NEXT_APPOINTMENT] blocks from Backboard AI
 * responses and inserts them as tentative appointments in Supabase.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtractedAppointment {
  date: string;       // "YYYY-MM-DD" or relative like "Tuesday", "tomorrow"
  time: string;       // "HH:MM" (24h) or "10:00 AM"
  type: string;       // event_type value
  description: string; // short title
  location?: string | null;
}

export interface AppointmentRecord {
  id: string;
  worker_id: string;
  client_id: string;
  title: string;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  source: "ai_extracted" | "manual";
  source_message_id: string | null;
  status: "confirmed" | "tentative" | "dismissed" | "completed";
  created_at: string;
  updated_at: string;
}

// ─── Valid event types ───────────────────────────────────────────────────────

const VALID_EVENT_TYPES = [
  "home_visit", "court", "medical", "phone_call", "office", "transport", "other",
] as const;

function normalizeEventType(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if ((VALID_EVENT_TYPES as readonly string[]).includes(lower)) return lower;

  // Common aliases
  if (lower.includes("visit") || lower.includes("home")) return "home_visit";
  if (lower.includes("court") || lower.includes("legal")) return "court";
  if (lower.includes("medical") || lower.includes("doctor") || lower.includes("clinic")) return "medical";
  if (lower.includes("phone") || lower.includes("call")) return "phone_call";
  if (lower.includes("office") || lower.includes("meeting")) return "office";
  if (lower.includes("transport") || lower.includes("pickup") || lower.includes("drive")) return "transport";
  return "other";
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Extract a [NEXT_APPOINTMENT]...[/NEXT_APPOINTMENT] JSON block from AI response text.
 * Returns null if no appointment block is found or parsing fails.
 */
export function parseAppointmentFromResponse(text: string): ExtractedAppointment | null {
  const regex = /\[NEXT_APPOINTMENT\]([\s\S]*?)\[\/NEXT_APPOINTMENT\]/;
  const match = text.match(regex);
  if (!match) return null;

  try {
    const raw = JSON.parse(match[1].trim());

    if (!raw.date || !raw.time) return null;

    return {
      date: String(raw.date).trim(),
      time: String(raw.time).trim(),
      type: raw.type ? String(raw.type).trim() : "other",
      description: raw.description ? String(raw.description).trim() : "Scheduled visit",
      location: raw.location ? String(raw.location).trim() : null,
    };
  } catch (e) {
    console.warn("[extract-appointment] Failed to parse JSON:", e);
    return null;
  }
}

/**
 * Strip the [NEXT_APPOINTMENT] block from a response so it doesn't show in notes.
 */
export function stripAppointmentBlock(text: string): string {
  return text.replace(/\[NEXT_APPOINTMENT\][\s\S]*?\[\/NEXT_APPOINTMENT\]/g, "").trim();
}

// ─── Date Resolution ─────────────────────────────────────────────────────────

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Resolve a date string + time string into a full Date object.
 * Handles:
 *   - ISO dates: "2026-03-12"
 *   - Relative: "tomorrow", "today"
 *   - Day names: "Tuesday", "next Wednesday"
 *   - Time: "10:00", "10:00 AM", "3:30 PM", "15:00"
 */
export function resolveAppointmentDate(
  dateStr: string,
  timeStr: string,
  referenceDate?: Date
): Date {
  const now = referenceDate ?? new Date();
  let targetDate: Date;

  const dateLower = dateStr.toLowerCase().trim();

  // ISO date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateLower)) {
    const [y, m, d] = dateLower.split("-").map(Number);
    targetDate = new Date(y, m - 1, d);
  }
  // "today"
  else if (dateLower === "today") {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  // "tomorrow"
  else if (dateLower === "tomorrow") {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
  // Day name: "Tuesday", "next Tuesday"
  else {
    const cleaned = dateLower.replace("next ", "");
    const dayIndex = DAY_NAMES.indexOf(cleaned);
    if (dayIndex !== -1) {
      const currentDay = now.getDay();
      let daysAhead = dayIndex - currentDay;
      if (daysAhead <= 0) daysAhead += 7; // Always future
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
    } else {
      // Fallback: try native parsing, then default to tomorrow
      const parsed = new Date(dateStr);
      targetDate = isNaN(parsed.getTime())
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        : parsed;
    }
  }

  // Parse time
  const timeLower = timeStr.trim().toLowerCase();
  let hours = 9, minutes = 0; // default 9 AM

  // "3:30 PM", "10:00 AM"
  const ampmMatch = timeLower.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (ampmMatch) {
    hours = parseInt(ampmMatch[1], 10);
    minutes = parseInt(ampmMatch[2], 10);
    if (ampmMatch[3] === "pm" && hours !== 12) hours += 12;
    if (ampmMatch[3] === "am" && hours === 12) hours = 0;
  } else {
    // "15:00" or "10:00"
    const h24Match = timeLower.match(/^(\d{1,2}):(\d{2})$/);
    if (h24Match) {
      hours = parseInt(h24Match[1], 10);
      minutes = parseInt(h24Match[2], 10);
    }
  }

  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate;
}

// ─── Database Insertion ──────────────────────────────────────────────────────

/**
 * Insert an AI-extracted appointment into the database.
 * Always creates with source='ai_extracted' and status='tentative'.
 */
export async function insertExtractedAppointment(
  workerId: string,
  clientId: string,
  extracted: ExtractedAppointment,
  sourceMessageId?: string
): Promise<AppointmentRecord | null> {
  try {
    const startsAt = resolveAppointmentDate(extracted.date, extracted.time);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000); // +1 hour default

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        worker_id: workerId,
        client_id: clientId,
        title: extracted.description,
        event_type: normalizeEventType(extracted.type),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        location: extracted.location || null,
        source: "ai_extracted",
        source_message_id: sourceMessageId || null,
        status: "tentative",
      })
      .select()
      .single();

    if (error) {
      console.error("[extract-appointment] Insert failed:", error.message);
      return null;
    }

    return data as AppointmentRecord;
  } catch (e) {
    console.error("[extract-appointment] Error:", e);
    return null;
  }
}
