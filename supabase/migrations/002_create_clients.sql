-- Waypoint: Clients table
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- ─── Schema ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  tags TEXT[] DEFAULT '{}',
  risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MED', 'HIGH')),
  backboard_thread_id TEXT,
  assigned_worker_id UUID REFERENCES users(id),
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS — same deny-all pattern as the users table.
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access"
  ON clients
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ─── Seed Test Clients ──────────────────────────────────────────────────────

INSERT INTO clients (name, phone, tags, risk_level, summary) VALUES
  (
    'Alex Mercer',
    '+1 (416) 555-0101',
    ARRAY['HOUSING', 'MENTAL_HEALTH'],
    'HIGH',
    'Bipolar disorder, missed rent payment, eviction risk. Medication non-adherence.'
  ),
  (
    'Sam Riley',
    '+1 (416) 555-0202',
    ARRAY['SUBSTANCE_USE'],
    'MED',
    'Substance use challenges, stable housing, engaged with outreach.'
  ),
  (
    'Jamie Torres',
    '+1 (416) 555-0303',
    ARRAY['HOUSING'],
    'LOW',
    'Stable housing, attending check-ins regularly, low risk.'
  )
ON CONFLICT DO NOTHING;
