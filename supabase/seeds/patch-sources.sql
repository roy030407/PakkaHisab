-- ============================================================================
-- PATCH: Fix transaction sources for demo data
-- Run this once in Supabase SQL editor to fix existing live data.
--
-- Target breakdown:
--   Sales:     70% voice, 30% bill_scan, 0% manual_quick
--   Purchases: 100% bill_scan
--   Expenses/payments: manual_full (shows as Full Entry, tiny slice)
-- Result: Quick Entry bar should show 0-1%, Voice ~65-70%, Scan ~25-30%
-- ============================================================================

-- Step 1: Fix purchases - all should be bill_scan
UPDATE transactions
SET source = 'bill_scan'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type = 'purchase'
  AND source IN ('manual_quick', 'manual_full');

-- Step 2: Fix expenses and payments - use manual_full (Full Entry, small %)
UPDATE transactions
SET source = 'manual_full'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type IN ('expense', 'payment', 'income')
  AND source IN ('manual_quick');

-- Step 3: Sales - 70% voice (dominant recent use), 30% bill_scan, 0% quick entry
-- Row number modulo distributes deterministically (re-runnable)
WITH ranked_sales AS (
  SELECT id,
         row_number() OVER (ORDER BY date, id) AS rn
  FROM transactions
  WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
    AND notes LIKE 'DEMO_SEED%'
    AND type = 'sale'
    AND source IN ('manual_quick', 'manual_full')
)
UPDATE transactions t
SET source = CASE
  WHEN r.rn % 10 < 7 THEN 'voice'
  ELSE 'bill_scan'
END
FROM ranked_sales r
WHERE t.id = r.id;

-- Verify the result (you should see voice ~65%, bill_scan ~30%, manual_full ~5%, manual_quick 0):
SELECT source, count(*) as cnt,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) as pct
FROM transactions
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
GROUP BY source
ORDER BY cnt DESC;
