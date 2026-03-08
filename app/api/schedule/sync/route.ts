/**
 * GET  /api/schedule/sync — Check sync status (is Google connected? token info)
 * POST /api/schedule/sync — Trigger a two-way Google Calendar sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";
import { syncCalendar, isGoogleConnected, getGoogleTokens } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workerId = await getCurrentWorkerId(session.user.sub);
    const connected = await isGoogleConnected(workerId);
    const tokens = connected ? await getGoogleTokens(workerId) : null;

    return NextResponse.json({
      connected,
      hasRefreshToken: !!tokens?.refresh_token,
      expiresAt: tokens?.expires_at ?? null,
      calendarId: tokens?.calendar_id ?? null,
    });
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

    const connected = await isGoogleConnected(workerId);
    if (!connected) {
      return NextResponse.json(
        { error: "Google Calendar not connected", needsConnection: true },
        { status: 400 }
      );
    }

    const result = await syncCalendar(workerId);

    return NextResponse.json({
      success: true,
      pulled: result.pulled,
      pushed: result.pushed,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
