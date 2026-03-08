/**
 * AI-powered schedule extraction from case notes, transcripts, and documents.
 *
 * Uses Backboard (Gemini Flash, Readonly memory) to detect dates, deadlines,
 * appointments, and follow-ups mentioned in text, then inserts them as
 * "suggested" schedule events for the worker to accept or dismiss.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessageWithModel, GEMINI_FLASH_CONFIG } from "@/lib/backboard";

export interface ExtractedScheduleItem {
  title: string;
  date: string;       // YYYY-MM-DD
  time: string | null; // HH:MM or null
  description: string;
  priority: "low" | "normal" | "high";
}

export interface InsertedScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  priority: string;
  client_id: string | null;
  client_name?: string;
}

const EXTRACTION_PROMPT = (
  clientName: string,
  todayDate: string,
  noteContent: string
) => `You are a scheduling assistant for a social worker's case management system.

TASK: Extract ALL dates, deadlines, appointments, follow-ups, court dates, and scheduled events from this case note.

RULES:
- Extract ONLY explicitly stated dates/deadlines. NEVER fabricate or infer dates.
- If a relative date is used (e.g. "next Tuesday", "in two weeks"), resolve it relative to today: ${todayDate}.
- Each item needs a short, actionable title (e.g. "Court hearing — ${clientName}", "Follow-up with Dr. Patel").
- Include a 1-sentence description with context from the note.
- Assess priority: "high" for court dates, evictions, medical emergencies; "normal" for standard follow-ups; "low" for optional/tentative.
- If NO schedule-relevant items exist, return an empty array.

OUTPUT FORMAT — respond with ONLY a valid JSON array, no markdown fences:
[{"title":"...","date":"YYYY-MM-DD","time":"HH:MM" or null,"description":"...","priority":"low"|"normal"|"high"}]

Case note for ${clientName}:
${noteContent}`;

/**
 * Extract schedule items from a note and insert as suggested events.
 * Fire-and-forget safe — catches all errors internally.
 *
 * @returns Array of inserted suggested events (empty on failure).
 */
export async function extractScheduleItems(
  threadId: string,
  noteContent: string,
  clientId: string,
  clientName: string,
  workerId: string
): Promise<InsertedScheduleEvent[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const prompt = EXTRACTION_PROMPT(clientName, today, noteContent);

    const response = await sendMessageWithModel(
      threadId,
      prompt,
      GEMINI_FLASH_CONFIG,
      { memory: "Readonly" }
    );

    const raw = response.content?.trim() ?? "[]";

    // Parse — handle cases where AI wraps in markdown fences
    let cleaned = raw;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let items: ExtractedScheduleItem[];
    try {
      items = JSON.parse(cleaned);
    } catch {
      console.warn("[extract-schedule] Failed to parse AI response:", raw.slice(0, 200));
      return [];
    }

    if (!Array.isArray(items) || items.length === 0) return [];

    // Validate and insert
    const supabase = createAdminClient();
    const inserted: InsertedScheduleEvent[] = [];

    for (const item of items) {
      if (!item.title || !item.date) continue;

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) continue;

      const startTime = item.time
        ? new Date(`${item.date}T${item.time}:00`).toISOString()
        : new Date(`${item.date}T09:00:00`).toISOString(); // Default 9 AM

      const endTime = item.time
        ? new Date(new Date(`${item.date}T${item.time}:00`).getTime() + 60 * 60 * 1000).toISOString() // +1 hour
        : null;

      const { data: event, error } = await supabase
        .from("schedule_events")
        .insert({
          worker_id: workerId,
          client_id: clientId,
          title: item.title.slice(0, 200),
          description: (item.description ?? "").slice(0, 500),
          start_time: startTime,
          end_time: endTime,
          all_day: !item.time,
          status: "suggested",
          source: "ai_extracted",
          priority: ["low", "normal", "high"].includes(item.priority) ? item.priority : "normal",
        })
        .select("id, title, start_time, priority, client_id")
        .single();

      if (!error && event) {
        inserted.push({ ...event, client_name: clientName });
      }
    }

    if (inserted.length > 0) {
      console.log(`[extract-schedule] Inserted ${inserted.length} suggested events for ${clientName}`);
    }

    return inserted;
  } catch (err) {
    console.error("[extract-schedule] Extraction failed (non-fatal):", err);
    return [];
  }
}
