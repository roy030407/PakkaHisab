-- ============================================================================
-- PATCH ALL SOURCES - Fix source distribution for ALL transactions
-- ============================================================================
-- Run this in Supabase SQL Editor after RESET-AND-RESEED.sql.
-- Unlike the old patch, this targets ALL transactions (seed + real test entries)
-- so real quick-entry test transactions don't drown out the seed distribution.
--
-- Targets (based on all transactions, not just DEMO_SEED):
--   Sales:            manual_quick 44% | voice 33% | bill_scan 22%
--   Purchases:        bill_scan 100%
--   Expenses/payments: manual_full 100%
-- ============================================================================

-- Step 1: All purchases → bill_scan
UPDATE transactions
SET source = 'bill_scan'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND type = 'purchase';

-- Step 2: All expenses and payments → manual_full
UPDATE transactions
SET source = 'manual_full'
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND type IN ('expense', 'payment', 'income');

-- Step 3: All sales → deterministic 44/33/22 distribution
-- Per 9 rows (ordered by date then id): 4 quick, 3 voice, 2 scan
WITH ranked_sales AS (
  SELECT id,
         row_number() OVER (ORDER BY date, id) AS rn
  FROM transactions
  WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
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

-- Verify (expect: manual_quick ~44%, voice ~33%, bill_scan ~22%, manual_full ~4%)
SELECT
  source,
  count(*)                                                      AS cnt,
  round(100.0 * count(*) / sum(count(*)) OVER (), 1)           AS pct
FROM transactions
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
GROUP BY source
ORDER BY cnt DESC;
