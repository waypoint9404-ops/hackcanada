/**
 * GET /api/google/auth
 *
 * Redirects the user to Google's OAuth2 consent screen to grant
 * calendar access. This is a direct Google OAuth flow — no Auth0 involvement.
 *
 * Query params:
 *   returnTo — URL to redirect back to after linking (default: /schedule)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: NextRequest) {
  // Must be logged in
  const session = await auth0.getSession(request);
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login?returnTo=/schedule", request.nextUrl.origin));
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/schedule";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = (process.env.APP_BASE_URL || request.nextUrl.origin).replace(/\/+$/, "");

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/google/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly email",
    access_type: "offline",
    prompt: "consent",  // Always show consent → ensures refresh_token is returned
    state: returnTo,    // Pass returnTo through the OAuth state param
    include_granted_scopes: "true",
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
