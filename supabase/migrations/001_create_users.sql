-- Waypoint: Users table
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth0_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'social_worker',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS — default-deny for all roles without explicit policies.
-- The secret key (SUPABASE_DEFAULT_SECRET_KEY) bypasses RLS server-side.
-- The publishable key used by the browser gets zero access to this table.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all policy for the anon role (belt-and-suspenders alongside the default deny).
-- Even if a future policy accidentally grants broad access, this blocks the publishable key.
CREATE POLICY "anon_no_access"
  ON users
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- NOTE: The Next.js server uses the secret key (SUPABASE_DEFAULT_SECRET_KEY).
-- That key's role has bypassrls = true, so it is never subject to any policy above.
-- All reads and writes in this app go through the server-side admin client only.
