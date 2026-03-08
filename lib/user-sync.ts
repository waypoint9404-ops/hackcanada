import { createAdminClient } from "@/lib/supabase/admin";

interface Auth0User {
  sub: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Upsert the Auth0 user into the Supabase `users` table.
 * Called on every authenticated page load — the upsert is idempotent.
 *
 * Google Calendar tokens are stored separately via the direct OAuth flow
 * (/api/google/auth → /api/google/callback), not through Auth0 claims.
 */
export async function syncUser(auth0User: Auth0User) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        auth0_id: auth0User.sub,
        email: auth0User.email ?? null,
        name: auth0User.name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auth0_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[syncUser] Supabase upsert failed:", error.message);
  }

  return { data, error };
}

/**
 * Fetch the full Supabase profile for a given Auth0 sub.
 */
export async function getProfile(auth0Id: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth0_id", auth0Id)
    .single();

  if (error) {
    console.error("[getProfile] Supabase fetch failed:", error.message);
  }

  return { data, error };
}

/**
 * Fetch the Supabase worker ID given their Auth0 sub.
 * Throws if not found or on error. Useful for protected routes.
 */
export async function getCurrentWorkerId(auth0Id: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("auth0_id", auth0Id)
    .single();

  if (error || !data) {
    throw new Error(`Worker profile not found for auth0_id: ${auth0Id}`);
  }

  return data.id;
}
