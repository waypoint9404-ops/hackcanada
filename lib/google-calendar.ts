/**
 * Google Calendar integration via REST API.
 *
 * Uses OAuth2 tokens stored in Supabase `users` table.
 * Tokens are obtained when a user links Google via Auth0.
 * Auto-refreshes expired access tokens via the refresh token.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null; // ISO timestamp
  calendar_id: string;
}

export interface GCalEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  colorId?: string; // 1-11, Google Calendar event color
}

export interface GCalEventInput {
  title: string;
  description?: string;
  start_time: string;   // ISO
  end_time?: string;     // ISO
  all_day?: boolean;
  timezone?: string;
  colorId?: string; // Google Calendar event color (1-11). 9 = grape for AI events.
}

// ─── Token Management ────────────────────────────────────────────────────────

/**
 * Retrieve and auto-refresh Google tokens for a worker.
 * Returns null if the worker hasn't connected Google.
 * Works with access_token alone (refresh_token is optional for initial use).
 */
export async function getGoogleTokens(workerId: string): Promise<GoogleTokens | null> {
  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id")
    .eq("id", workerId)
    .single();

  if (error || !user?.google_access_token) {
    return null;
  }

  const tokens: GoogleTokens = {
    access_token: user.google_access_token,
    refresh_token: user.google_refresh_token ?? null,
    expires_at: user.google_token_expires_at ?? null,
    calendar_id: user.google_calendar_id || "primary",
  };

  // Try to refresh if expired and we have a refresh token
  if (tokens.expires_at && tokens.refresh_token) {
    const expiresAt = new Date(tokens.expires_at).getTime();
    if (Date.now() > expiresAt - 60_000) {
      const refreshed = await refreshAccessToken(workerId, tokens.refresh_token);
      if (refreshed) {
        tokens.access_token = refreshed.access_token;
        tokens.expires_at = refreshed.expires_at;
      } else {
        // Refresh failed — still try with old token, it might work
        console.warn("[google-calendar] Token refresh failed, trying with existing token");
      }
    }
  }

  return tokens;
}

async function refreshAccessToken(
  workerId: string,
  refreshToken: string
): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error("[google-calendar] Token refresh failed:", await res.text());
      return null;
    }

    const data = await res.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    // Update in Supabase
    const supabase = createAdminClient();
    await supabase
      .from("users")
      .update({
        google_access_token: data.access_token,
        google_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workerId);

    return { access_token: data.access_token, expires_at: expiresAt };
  } catch (err) {
    console.error("[google-calendar] Token refresh error:", err);
    return null;
  }
}

/**
 * Store Google OAuth tokens for a worker after Auth0 callback.
 */
export async function storeGoogleTokens(
  workerId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await supabase
    .from("users")
    .update({
      google_access_token: accessToken,
      google_refresh_token: refreshToken,
      google_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workerId);
}

// ─── Calendar CRUD ───────────────────────────────────────────────────────────

async function gcalFetch(
  tokens: GoogleTokens,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(tokens.calendar_id)}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * Create an event in Google Calendar.
 * Returns the Google event ID.
 */
export async function createGCalEvent(
  workerId: string,
  event: GCalEventInput
): Promise<string | null> {
  const tokens = await getGoogleTokens(workerId);
  if (!tokens) return null;

  const body: GCalEvent = {
    summary: event.title,
    description: event.description,
    start: event.all_day
      ? { date: event.start_time.split("T")[0] }
      : { dateTime: event.start_time, timeZone: event.timezone ?? "America/Toronto" },
    end: event.all_day
      ? { date: event.end_time ? event.end_time.split("T")[0] : event.start_time.split("T")[0] }
      : { dateTime: event.end_time ?? new Date(new Date(event.start_time).getTime() + 3600000).toISOString(), timeZone: event.timezone ?? "America/Toronto" },
    ...(event.colorId ? { colorId: event.colorId } : {}),
  };

  try {
    const res = await gcalFetch(tokens, "/events", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[google-calendar] Create failed:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.id;
  } catch (err) {
    console.error("[google-calendar] Create error:", err);
    return null;
  }
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateGCalEvent(
  workerId: string,
  googleEventId: string,
  event: Partial<GCalEventInput>
): Promise<boolean> {
  const tokens = await getGoogleTokens(workerId);
  if (!tokens) return false;

  const patch: Partial<GCalEvent> = {};
  if (event.title) patch.summary = event.title;
  if (event.description !== undefined) patch.description = event.description;
  if (event.start_time) {
    patch.start = event.all_day
      ? { date: event.start_time.split("T")[0] }
      : { dateTime: event.start_time, timeZone: event.timezone ?? "America/Toronto" };
  }
  if (event.end_time || event.start_time) {
    const endStr = event.end_time ?? (event.start_time ? new Date(new Date(event.start_time).getTime() + 3600000).toISOString() : undefined);
    if (endStr) {
      patch.end = event.all_day
        ? { date: endStr.split("T")[0] }
        : { dateTime: endStr, timeZone: event.timezone ?? "America/Toronto" };
    }
  }

  try {
    const res = await gcalFetch(tokens, `/events/${encodeURIComponent(googleEventId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return res.ok;
  } catch (err) {
    console.error("[google-calendar] Update error:", err);
    return false;
  }
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteGCalEvent(
  workerId: string,
  googleEventId: string
): Promise<boolean> {
  const tokens = await getGoogleTokens(workerId);
  if (!tokens) return false;

  try {
    const res = await gcalFetch(tokens, `/events/${encodeURIComponent(googleEventId)}`, {
      method: "DELETE",
    });
    return res.ok || res.status === 404; // Already deleted = OK
  } catch (err) {
    console.error("[google-calendar] Delete error:", err);
    return false;
  }
}

/**
 * Fetch events from Google Calendar within a time range.
 */
export async function listGCalEvents(
  workerId: string,
  timeMin: string,
  timeMax: string
): Promise<GCalEvent[]> {
  const tokens = await getGoogleTokens(workerId);
  if (!tokens) return [];

  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const res = await gcalFetch(tokens, `/events?${params.toString()}`);
    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      console.error(`[google-calendar] List events failed (${res.status}):`, errText);
      return [];
    }

    const data = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error("[google-calendar] List error:", err);
    return [];
  }
}

/**
 * Two-way sync: pull Google Calendar events into schedule_events and
 * push local confirmed events (without google_event_id) to Google Calendar.
 *
 * @returns Counts of synced events.
 */
export async function syncCalendar(
  workerId: string,
  timeMin?: string,
  timeMax?: string
): Promise<{ pulled: number; pushed: number }> {
  const tokens = await getGoogleTokens(workerId);
  if (!tokens) return { pulled: 0, pushed: 0 };

  const supabase = createAdminClient();
  const now = new Date();
  const min = timeMin ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const max = timeMax ?? new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  let pulled = 0;
  let pushed = 0;

  // ─── Pull from Google ──────────────────────────────────────────────────
  try {
    const gcalEvents = await listGCalEvents(workerId, min, max);

    for (const ge of gcalEvents) {
      if (!ge.id) continue;

      // Check if we already have this event
      const { data: existing } = await supabase
        .from("schedule_events")
        .select("id")
        .eq("google_event_id", ge.id)
        .eq("worker_id", workerId)
        .maybeSingle();

      if (existing) continue; // Already tracked

      const startTime = ge.start?.dateTime ?? (ge.start?.date ? `${ge.start.date}T00:00:00Z` : null);
      const endTime = ge.end?.dateTime ?? (ge.end?.date ? `${ge.end.date}T23:59:59Z` : null);
      if (!startTime) continue;

      const { error } = await supabase.from("schedule_events").insert({
        worker_id: workerId,
        title: ge.summary ?? "Untitled",
        description: ge.description ?? null,
        start_time: startTime,
        end_time: endTime,
        all_day: !ge.start?.dateTime,
        status: ge.status === "cancelled" ? "cancelled" : "confirmed",
        source: "google_sync",
        google_event_id: ge.id,
      });

      if (!error) pulled++;
    }
  } catch (err) {
    console.error("[google-calendar] Pull sync error:", err);
  }

  // ─── Push to Google ────────────────────────────────────────────────────
  try {
    const { data: unsynced } = await supabase
      .from("schedule_events")
      .select("*")
      .eq("worker_id", workerId)
      .eq("status", "confirmed")
      .is("google_event_id", null)
      .neq("source", "google_sync");

    for (const evt of unsynced ?? []) {
      const googleId = await createGCalEvent(workerId, {
        title: evt.title,
        description: evt.description,
        start_time: evt.start_time,
        end_time: evt.end_time,
        all_day: evt.all_day,
      });

      if (googleId) {
        await supabase
          .from("schedule_events")
          .update({ google_event_id: googleId, updated_at: new Date().toISOString() })
          .eq("id", evt.id);
        pushed++;
      }
    }
  } catch (err) {
    console.error("[google-calendar] Push sync error:", err);
  }

  return { pulled, pushed };
}

/**
 * Check if a worker has connected Google Calendar.
 */
export async function isGoogleConnected(workerId: string): Promise<boolean> {
  const tokens = await getGoogleTokens(workerId);
  return tokens !== null;
}
