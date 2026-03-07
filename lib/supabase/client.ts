import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client using the publishable key.
 * Safe to use in Client Components — the publishable key is designed to be public.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
