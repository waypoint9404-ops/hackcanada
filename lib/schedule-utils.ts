/**
 * Shared types for the schedule feature.
 */

export interface ScheduleEvent {
  id: string;
  worker_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  status: "suggested" | "confirmed" | "completed" | "cancelled";
  source: "ai_extracted" | "manual" | "google_sync";
  google_event_id: string | null;
  source_note_message_id: string | null;
  priority: "low" | "normal" | "high";
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    risk_level: string;
  } | null;
}

export type ViewMode = "day" | "week" | "month";

// ─── Date Helpers ────────────────────────────────────────────────────────────

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateFull(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getMonthGrid(date: Date): Date[][] {
  const first = startOfMonth(date);
  const start = startOfWeek(first);
  const weeks: Date[][] = [];
  let current = start;

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);

    // Stop if we've passed the month
    if (current.getMonth() !== date.getMonth() && w >= 3) break;
  }

  return weeks;
}

export function getEventsForDay(events: ScheduleEvent[], date: Date): ScheduleEvent[] {
  return events.filter((e) => isSameDay(new Date(e.start_time), date));
}

export function getHourFromTime(dateStr: string): number {
  return new Date(dateStr).getHours();
}

export function getMinuteFromTime(dateStr: string): number {
  return new Date(dateStr).getMinutes();
}
