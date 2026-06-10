-- FILE: supabase/migrations/002_share_tokens.sql
-- WHAT THIS DOES: Adds share_token (UUID, unique) to periodic_reports
--   and a unique constraint on (store_id, report_type) for upsert support.
--   Also enables RLS on periodic_reports.
-- CHANGES: Phase 7 report sharing

-- share_token column
ALTER TABLE periodic_reports
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS periodic_reports_share_token_idx
  ON periodic_reports(share_token)
  WHERE share_token IS NOT NULL;

-- Unique constraint for upsert (one row per store per period type)
ALTER TABLE periodic_reports
  DROP CONSTRAINT IF EXISTS periodic_reports_store_period_uniq;

ALTER TABLE periodic_reports
  ADD CONSTRAINT periodic_reports_store_period_uniq
  UNIQUE (store_id, report_type);

-- Enable RLS
ALTER TABLE periodic_reports ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating (CREATE POLICY has no IF NOT EXISTS in Postgres)
DROP POLICY IF EXISTS "periodic_reports_owner_all" ON periodic_reports;
DROP POLICY IF EXISTS "periodic_reports_public_share_read" ON periodic_reports;

-- Authenticated owner can read/write their own reports
CREATE POLICY "periodic_reports_owner_all"
  ON periodic_reports FOR ALL
  USING (store_id IN (
    SELECT id FROM stores WHERE owner_id = auth.uid()::text
  ))
  WITH CHECK (store_id IN (
    SELECT id FROM stores WHERE owner_id = auth.uid()::text
  ));

-- Public can SELECT a single row by share_token (no auth required)
CREATE POLICY "periodic_reports_public_share_read"
  ON periodic_reports FOR SELECT
  USING (share_token IS NOT NULL);
