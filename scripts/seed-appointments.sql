-- ═══════════════════════════════════════════════════════════════════════════
-- Quick-insert test appointments for the Smart Triage Itinerary
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Run this in the Supabase SQL Editor AFTER:
--   1. Running 004_create_appointments.sql migration
--   2. Having at least one worker and some clients in the DB
--
-- This script auto-discovers the first worker and their clients,
-- then inserts a realistic set of today's appointments.
-- ═══════════════════════════════════════════════════════════════════════════

-- Clean any previous test data
DELETE FROM appointments;

-- Use the first available worker
DO $$
DECLARE
  v_worker_id UUID;
  v_client1_id UUID;
  v_client2_id UUID;
  v_client3_id UUID;
  v_client4_id UUID;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get a worker
  SELECT id INTO v_worker_id FROM users LIMIT 1;
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'No workers found. Log in to the app first to create a user record.';
  END IF;

  -- Get up to 4 clients for this worker (or any clients)
  SELECT id INTO v_client1_id FROM clients WHERE assigned_worker_id = v_worker_id ORDER BY created_at LIMIT 1;
  SELECT id INTO v_client2_id FROM clients WHERE assigned_worker_id = v_worker_id ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO v_client3_id FROM clients WHERE assigned_worker_id = v_worker_id ORDER BY created_at OFFSET 2 LIMIT 1;
  SELECT id INTO v_client4_id FROM clients WHERE assigned_worker_id = v_worker_id ORDER BY created_at OFFSET 3 LIMIT 1;

  -- Fallback: use any clients if worker has none assigned
  IF v_client1_id IS NULL THEN
    SELECT id INTO v_client1_id FROM clients ORDER BY created_at LIMIT 1;
  END IF;
  IF v_client2_id IS NULL THEN v_client2_id := v_client1_id; END IF;
  IF v_client3_id IS NULL THEN v_client3_id := v_client1_id; END IF;
  IF v_client4_id IS NULL THEN v_client4_id := v_client1_id; END IF;

  IF v_client1_id IS NULL THEN
    RAISE EXCEPTION 'No clients found. Run seed-clients.ts first.';
  END IF;

  RAISE NOTICE 'Worker: %', v_worker_id;
  RAISE NOTICE 'Clients: %, %, %, %', v_client1_id, v_client2_id, v_client3_id, v_client4_id;

  -- ─── TODAY: Confirmed appointments ───────────────────────────────────────

  -- 8:30 AM — Court transport (confirmed, manual)
  INSERT INTO appointments (worker_id, client_id, title, event_type, starts_at, ends_at, location, notes, source, status)
  VALUES (
    v_worker_id, v_client1_id,
    'Court Transport — Bail Hearing', 'transport',
    (v_today + TIME '08:30')::timestamptz,
    (v_today + TIME '10:30')::timestamptz,
    'Ontario Superior Court, 361 University Ave',
    'Pick up client by 8:15. Bring extra ID replacement docs.',
    'manual', 'confirmed'
  );

  -- 11:00 AM — Office meeting (confirmed, AI-extracted)
  INSERT INTO appointments (worker_id, client_id, title, event_type, starts_at, ends_at, location, notes, source, status)
  VALUES (
    v_worker_id, v_client2_id,
    'EI Application Follow-up', 'office',
    (v_today + TIME '11:00')::timestamptz,
    (v_today + TIME '12:00')::timestamptz,
    'Community Resource Centre, 120 Carlton St',
    'Review EI documentation status. Bring legal aid referral printout.',
    'ai_extracted', 'confirmed'
  );

  -- ─── TODAY: Tentative appointments (AI-extracted, need confirm/dismiss) ──

  -- 2:00 PM — Home visit (tentative)
  INSERT INTO appointments (worker_id, client_id, title, event_type, starts_at, ends_at, location, notes, source, status)
  VALUES (
    v_worker_id, v_client3_id,
    'Welfare Check — Housing Follow-up', 'home_visit',
    (v_today + TIME '14:00')::timestamptz,
    (v_today + TIME '15:00')::timestamptz,
    'Youth Drop-in Centre, 40 Oak St',
    'AI extracted from transcript: "I''ll try to come by Tuesday around 2."',
    'ai_extracted', 'tentative'
  );

  -- 4:30 PM — Phone call (tentative)
  INSERT INTO appointments (worker_id, client_id, title, event_type, starts_at, ends_at, location, notes, source, status)
  VALUES (
    v_worker_id, v_client1_id,
    'Post-Hearing Phone Debrief', 'phone_call',
    (v_today + TIME '16:30')::timestamptz,
    (v_today + TIME '17:00')::timestamptz,
    NULL,
    'AI extracted: Worker said "I''ll call you after court to see how it went."',
    'ai_extracted', 'tentative'
  );

  -- ─── TOMORROW: Upcoming (affects deadline scoring in suggestions) ────────

  INSERT INTO appointments (worker_id, client_id, title, event_type, starts_at, ends_at, location, notes, source, status)
  VALUES (
    v_worker_id, v_client2_id,
    'Legal Aid Appointment', 'court',
    (v_today + INTERVAL '1 day' + TIME '10:00')::timestamptz,
    (v_today + INTERVAL '1 day' + TIME '12:00')::timestamptz,
    'Legal Aid Ontario, 40 Dundas St W',
    'Landlord deposit dispute. Bring all documentation.',
    'manual', 'confirmed'
  );

  -- ─── 3 DAYS: Upcoming deadline (affects suggestion scoring) ──────────────

  INSERT INTO appointments (worker_id, client_id, title, event_type, starts_at, ends_at, location, notes, source, status)
  VALUES (
    v_worker_id, v_client3_id,
    'Youth Housing Navigator Intake', 'office',
    (v_today + INTERVAL '3 days' + TIME '09:30')::timestamptz,
    (v_today + INTERVAL '3 days' + TIME '11:00')::timestamptz,
    'Youth Services, 365 Bloor St E',
    'CRITICAL: Intake for youth transitional housing. Must attend or slot is lost.',
    'manual', 'confirmed'
  );

  -- ─── YESTERDAY: Completed (won't show in today but proves history) ───────

  INSERT INTO appointments (worker_id, client_id, title, event_type, starts_at, ends_at, location, notes, source, status)
  VALUES (
    v_worker_id, v_client2_id,
    'EI Office Visit', 'office',
    (v_today - INTERVAL '1 day' + TIME '14:00')::timestamptz,
    (v_today - INTERVAL '1 day' + TIME '15:00')::timestamptz,
    'Service Canada, 25 St Clair Ave E',
    'Submitted EI forms. Client expects first payment in 2 weeks.',
    'manual', 'completed'
  );

  -- ─── Backdate some clients for triage scoring ────────────────────────────

  -- Make client3 look stale (14 days ago) to boost suggestion score
  UPDATE clients SET updated_at = NOW() - INTERVAL '14 days' WHERE id = v_client3_id;

  -- Make client4 look moderately stale (8 days ago)
  IF v_client4_id != v_client1_id THEN
    UPDATE clients SET updated_at = NOW() - INTERVAL '8 days' WHERE id = v_client4_id;
  END IF;

  RAISE NOTICE 'Done! Inserted 7 appointments and backdated client timestamps.';
END $$;

-- Verify
SELECT
  a.title,
  a.event_type,
  a.starts_at::date AS date,
  to_char(a.starts_at, 'HH24:MI') AS time,
  a.status,
  a.source,
  c.name AS client_name
FROM appointments a
JOIN clients c ON c.id = a.client_id
ORDER BY a.starts_at;
