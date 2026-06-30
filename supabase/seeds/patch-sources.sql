-- ============================================================================
-- PATCH: Fix transaction sources for demo data
-- Run this once in Supabase SQL editor to fix existing live data.
--
-- Changes all manual_quick/manual_full SALE transactions tagged DEMO_SEED
-- to a realistic mix: ~60% voice, ~30% bill_scan, ~10% manual_full.
-- Purchases get bill_scan. Expenses/payments stay as manual_full.
-- ============================================================================

-- Step 1: Fix purchases - all should be bill_scan
UPDATE transactions
SET source = 'bill_scan'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type = 'purchase'
  AND source IN ('manual_quick', 'manual_full');

-- Step 2: Fix expenses and payments - manual_full is correct
UPDATE transactions
SET source = 'manual_full'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
  AND type IN ('expense', 'payment', 'income')
  AND source = 'manual_quick';

-- Step 3: Sales - 60% voice, 30% bill_scan, 10% manual_full
-- Use row number modulo to deterministically distribute (stable, re-runnable)
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
  WHEN r.rn % 10 < 6 THEN 'voice'
  WHEN r.rn % 10 < 9 THEN 'bill_scan'
  ELSE 'manual_full'
END
FROM ranked_sales r
WHERE t.id = r.id;

-- Verify the result:
SELECT source, count(*) as cnt
FROM transactions
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
GROUP BY source
ORDER BY cnt DESC;
