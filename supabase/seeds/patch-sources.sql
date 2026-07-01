-- ============================================================================
-- PATCH: Fix transaction sources for demo data
-- Run this once in Supabase SQL editor to fix existing live data.
--
-- Target breakdown:
--   Sales:     ~33% voice, ~33% bill_scan, ~33% manual_quick (balanced use)
--   Purchases: bill_scan (scanning supplier invoices)
--   Expenses/payments: manual_full (almost none - <5% of total)
-- ============================================================================

-- Step 1: Fix purchases - all should be bill_scan (scanning delivery notes)
UPDATE transactions
SET source = 'bill_scan'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type = 'purchase'
  AND source IN ('manual_quick', 'manual_full');

-- Step 2: Fix expenses and payments - manual_full (tiny slice, admin entries)
UPDATE transactions
SET source = 'manual_full'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type IN ('expense', 'payment', 'income')
  AND source IN ('manual_quick', 'voice');

-- Step 3: Sales - balanced 3-way split: voice / bill_scan / manual_quick
-- Row number mod 3 cycles evenly through all three sources
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
  WHEN r.rn % 3 = 0 THEN 'bill_scan'
  WHEN r.rn % 3 = 1 THEN 'voice'
  ELSE                    'manual_quick'
END
FROM ranked_sales r
WHERE t.id = r.id;

-- Verify (expect: voice ~33%, bill_scan ~38%, manual_quick ~33%, manual_full ~5%):
SELECT source, count(*) as cnt,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) as pct
FROM transactions
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
GROUP BY source
ORDER BY cnt DESC;
