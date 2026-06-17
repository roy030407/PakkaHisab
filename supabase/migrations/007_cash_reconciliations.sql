-- FILE: supabase/migrations/007_cash_reconciliations.sql
-- WHAT THIS DOES: Adds the cash_reconciliations table for Slice C (end-of-day
--   "Din ka hisab" cash close). One row per store per day; re-closing the same
--   day upserts. Stores snapshots of cash in/out, expected, UPI, and the counted
--   amount so each close is an immutable record. RLS scopes every row to the
--   owning store. DB-level defaults for id and updated_at are required because
--   inserts go through Supabase/PostgREST (which omit them).
--
-- CHANGES THIS SESSION:
--   - New table: cash_reconciliations (+ RLS policies + id/updated_at defaults)
--
-- HOW TO APPLY:
--   Paste this file into the Supabase SQL editor and run.
--   Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS cash_reconciliations (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id      text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date          date NOT NULL,
  opening_cash  numeric(12,2) NOT NULL DEFAULT 0,
  cash_in       numeric(12,2) NOT NULL DEFAULT 0,
  cash_out      numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash numeric(12,2) NOT NULL DEFAULT 0,
  counted_cash  numeric(12,2) NOT NULL DEFAULT 0,
  upi_total     numeric(12,2) NOT NULL DEFAULT 0,
  difference    numeric(12,2) NOT NULL DEFAULT 0,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_reconciliations_store_date_uniq UNIQUE (store_id, date)
);

ALTER TABLE cash_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_reconciliations_owner_all" ON cash_reconciliations;
CREATE POLICY "cash_reconciliations_owner_all"
  ON cash_reconciliations FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- Verify:
-- SELECT cmd, policyname FROM pg_policies WHERE tablename = 'cash_reconciliations';
