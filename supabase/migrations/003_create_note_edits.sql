-- Waypoint: Note edits table + summary_edited flag
-- Run this in your Supabase SQL Editor

-- ─── Note Edits Table ───────────────────────────────────────────────────────
-- Stores worker overrides for individual Backboard thread messages.
-- On timeline read, edited content replaces the original Backboard message.

CREATE TABLE IF NOT EXISTS note_edits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,            -- Backboard message run_id / msg-index
  edited_content TEXT NOT NULL,
  edited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, message_id)
);

ALTER TABLE note_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access"
  ON note_edits
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ─── Add summary_edited flag to clients ─────────────────────────────────────
-- When true, GET /summary returns the cached summary instead of regenerating.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS summary_edited BOOLEAN DEFAULT false;
