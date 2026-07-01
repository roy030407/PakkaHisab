-- ============================================================================
-- PATCH: Fix transaction sources for demo data
-- Run this in Supabase SQL editor. Safe to re-run multiple times.
--
-- Target breakdown:
--   Sales:     ~44% manual_quick (dominant), ~33% voice, ~22% bill_scan
--   Purchases: bill_scan (scanning supplier invoices)
--   Expenses/payments: manual_full (tiny admin slice ~4%)
-- ============================================================================

-- Step 1: Fix purchases - all bill_scan (scanning delivery notes)
UPDATE transactions
SET source = 'bill_scan'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type = 'purchase';

-- Step 2: Fix expenses and payments - manual_full (admin entries, tiny %)
UPDATE transactions
SET source = 'manual_full'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type IN ('expense', 'payment', 'income');

-- Step 3: Sales - Quick Entry dominant, Voice and Scan increasing
-- Per 9 rows: 4 quick (44%), 3 voice (33%), 2 scan (22%)
-- Targets ALL sale transactions (safe to re-run after any previous patch)
WITH ranked_sales AS (
  SELECT id,
         row_number() OVER (ORDER BY date, id) AS rn
  FROM transactions
  WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
    AND notes LIKE 'DEMO_SEED%'
    AND type = 'sale'
)
UPDATE transactions t
SET source = CASE
  WHEN r.rn % 9 < 4 THEN 'manual_quick'
  WHEN r.rn % 9 < 7 THEN 'voice'
  ELSE                    'bill_scan'
END
FROM ranked_sales r
WHERE t.id = r.id;

-- Verify (expect: manual_quick ~44%, voice ~33%, bill_scan ~22%, manual_full ~4%):
SELECT source, count(*) as cnt,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) as pct
FROM transactions
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
GROUP BY source
ORDER BY cnt DESC;
