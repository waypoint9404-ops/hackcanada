/**
 * GET /api/google/callback
 *
 * Handles the OAuth2 callback from Google after the user grants consent.
 * Exchanges the authorization code for tokens and stores them in Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkerId } from "@/lib/user-sync";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state") || "/schedule";
  const baseUrl = (process.env.APP_BASE_URL || request.nextUrl.origin).replace(/\/+$/, "");

  // Handle user denial or error
  if (error) {
    console.error("[google/callback] OAuth error:", error);
    return NextResponse.redirect(
      new URL(`${state}?google_error=${encodeURIComponent(error)}`, baseUrl)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`${state}?google_error=no_code`, baseUrl)
    );
  }

  // Must be logged in
  const session = await auth0.getSession(request);
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login?returnTo=/schedule", baseUrl));
  }

  try {
    const workerId = await getCurrentWorkerId(session.user.sub);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL(`${state}?google_error=missing_config`, baseUrl)
      );
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[google/callback] Token exchange failed:", errBody);
      return NextResponse.redirect(
        new URL(`${state}?google_error=token_exchange_failed`, baseUrl)
      );
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token) {
      return NextResponse.redirect(
        new URL(`${state}?google_error=no_access_token`, baseUrl)
      );
    }

    // Fetch the user's Google email for the calendar iframe
    let googleEmail: string | null = null;
    try {
      const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        googleEmail = info.email ?? null;
      }
    } catch {
      // Non-fatal — we can still use "primary" for the iframe
    }

    // Store tokens in Supabase
    const supabase = createAdminClient();
    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    await supabase
      .from("users")
      .update({
        google_access_token: access_token,
        google_refresh_token: refresh_token ?? null,
        google_token_expires_at: expiresAt,
        google_calendar_id: googleEmail ?? "primary",
        updated_at: new Date().toISOString(),
      })
      .eq("id", workerId);

    console.log(`[google/callback] Google Calendar linked for worker ${workerId} (${googleEmail})`);

    // Redirect back to the schedule page
    return NextResponse.redirect(new URL(`${state}?google_linked=1`, baseUrl));
  } catch (err) {
    console.error("[google/callback] Error:", err);
    return NextResponse.redirect(
      new URL(`${state}?google_error=internal`, baseUrl)
    );
  }
}
