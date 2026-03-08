/**
 * GET  /api/google/status  — Check if Google Calendar is connected
 * POST /api/google/connect — Store Google tokens after OAuth callback
 * POST /api/google/disconnect — Remove Google Calendar connection
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkerId } from "@/lib/user-sync";
import { isGoogleConnected } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const connected = await isGoogleConnected(workerId);

    // Fetch Google email (stored as google_calendar_id) for iframe embed
    let googleEmail: string | null = null;
    if (connected) {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("users")
        .select("google_calendar_id")
        .eq("id", workerId)
        .single();
      googleEmail = data?.google_calendar_id ?? null;
      // If it's just "primary", fall back to the session email
      if (!googleEmail || googleEmail === "primary") {
        googleEmail = session.user.email ?? null;
      }
    }

    return NextResponse.json({ connected, email: googleEmail });
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
    const { access_token, refresh_token, expires_in } = body;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    await supabase
      .from("users")
      .update({
        google_access_token: access_token,
        google_refresh_token: refresh_token,
        google_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workerId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const supabase = createAdminClient();

    await supabase
      .from("users")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workerId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
