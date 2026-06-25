-- Migration: fixed_cost_overrides
-- Date: 2026-06-24
-- Adds monthly override amounts for fixed costs so merchants can record
-- one-off changes (e.g. rent was higher in a specific month).

CREATE TABLE IF NOT EXISTS fixed_cost_overrides (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fixed_cost_id TEXT NOT NULL REFERENCES fixed_costs(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (fixed_cost_id, month)
);

ALTER TABLE fixed_cost_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage overrides for their store costs"
  ON fixed_cost_overrides FOR ALL
  USING (
    fixed_cost_id IN (
      SELECT id FROM fixed_costs
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text)
    )
  );
