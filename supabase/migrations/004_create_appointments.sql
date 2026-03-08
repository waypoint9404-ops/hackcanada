-- Waypoint: Appointments table for Smart Triage Itinerary
-- Run this in your Supabase SQL Editor

-- ─── Appointments Table ──────────────────────────────────────────────────────
-- Stores both AI-extracted and manually-created scheduled events.
-- AI-extracted events start as 'tentative' and must be confirmed by the worker.

CREATE TABLE IF NOT EXISTS appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    UUID NOT NULL REFERENCES users(id),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'home_visit', 'court', 'medical', 'phone_call', 'office', 'transport', 'other'
  )),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ,
  location     TEXT,
  notes        TEXT,
  source       TEXT NOT NULL CHECK (source IN ('ai_extracted', 'manual')),
  source_message_id TEXT,            -- Backboard run_id for AI-extracted events
  status       TEXT NOT NULL DEFAULT 'tentative' CHECK (status IN (
    'confirmed', 'tentative', 'dismissed', 'completed'
  )),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient daily schedule queries
CREATE INDEX idx_appointments_worker_date ON appointments (worker_id, starts_at);

-- Index for filtering by status
CREATE INDEX idx_appointments_status ON appointments (status);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access"
  ON appointments
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ─── Auto-update updated_at trigger ──────────────────────────────────────────
-- Reuse the update_updated_at function if it exists, or create it
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
