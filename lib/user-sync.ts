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
