-- ============================================================
-- 005 — Schedule Events + Google Calendar tokens on users
-- ============================================================

-- Add Google Calendar OAuth columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_access_token    TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token   TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_calendar_id     TEXT DEFAULT 'primary';

-- Schedule Events table
CREATE TABLE IF NOT EXISTS schedule_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id              UUID REFERENCES clients(id) ON DELETE SET NULL,
  title                  TEXT NOT NULL,
  description            TEXT,
  start_time             TIMESTAMPTZ NOT NULL,
  end_time               TIMESTAMPTZ,
  all_day                BOOLEAN DEFAULT FALSE,
  status                 TEXT NOT NULL DEFAULT 'confirmed'
                           CHECK (status IN ('suggested','confirmed','completed','cancelled')),
  source                 TEXT NOT NULL DEFAULT 'manual'
                           CHECK (source IN ('ai_extracted','manual','google_sync')),
  google_event_id        TEXT,
  source_note_message_id TEXT,
  priority               TEXT NOT NULL DEFAULT 'normal'
                           CHECK (priority IN ('low','normal','high')),
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_schedule_events_worker_time
  ON schedule_events (worker_id, start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_events_client
  ON schedule_events (client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_status
  ON schedule_events (status);
CREATE INDEX IF NOT EXISTS idx_schedule_events_google
  ON schedule_events (google_event_id)
  WHERE google_event_id IS NOT NULL;

-- RLS: deny anonymous access (admin key / secret key bypasses)
ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;

-- Restrictive default: no access for the publishable key role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'schedule_events' AND policyname = 'deny_all_schedule_events'
  ) THEN
    CREATE POLICY deny_all_schedule_events ON schedule_events
      FOR ALL USING (false);
  END IF;
END $$;
