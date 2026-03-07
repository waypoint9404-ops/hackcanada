import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using the secret key — bypasses RLS.
 * NEVER import this in client components or expose it to the browser.
 * Only use in Server Components, Server Actions, and Route Handlers.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_PROJECT_URL;
  const secretKey = process.env.SUPABASE_DEFAULT_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing SUPABASE_PROJECT_URL or SUPABASE_DEFAULT_SECRET_KEY env vars."
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
