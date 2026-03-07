-- Waypoint: Documents table for case file uploads
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- ─── Documents Table ─────────────────────────────────────────────────────────
-- Stores metadata for uploaded case documents (PDFs, legal files, reports).
-- Actual files live in Supabase Storage bucket "case-documents".
-- Extracted text is cached here; the AI-structured note lives in the Backboard thread.

CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  extracted_text TEXT,
  document_type TEXT,
  ai_summary TEXT,
  linked_note_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS — same deny-all pattern as other tables.
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access"
  ON documents
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Index for fast lookups by client
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
