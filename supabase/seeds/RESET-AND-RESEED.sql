-- ============================================================================
-- RESET AND RESEED - Ram Kirana Demo Data
-- ============================================================================
-- Run this ONCE in Supabase SQL Editor.
-- Deletes ALL existing DEMO_SEED data and reinserts clean data with correct
-- source distribution from scratch. No separate patch needed.
--
-- Source targets (sales only):
--   manual_quick ~44%  (dominant - merchant taps + buttons most)
--   voice        ~33%  (second - growing over 4 weeks)
--   bill_scan    ~22%  (third - scanning purchase invoices)
--   manual_full    ~3% (only for payments and expenses)
--
-- Safe to run multiple times (DELETE + fresh INSERT each run).
-- ============================================================================

DO $$
DECLARE
  v_store  text;
  v_user   text;
  c_sharma text;
  c_verma  text;
  c_gupta  text;
  c_meena  text;
  c_saini  text;
  c_bajaj  text;
BEGIN

  -- ── 0. Find the store ───────────────────────────────────────────────────
  SELECT id, owner_id INTO v_store, v_user
  FROM stores
  WHERE name ILIKE '%ram kirana%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_store IS NULL THEN
    RAISE EXCEPTION 'No store matching "ram kirana" found.';
  END IF;

  RAISE NOTICE 'Found store: %', v_store;

  -- ── 1. Delete ALL existing demo seed data (safe to re-run) ─────────────
  DELETE FROM transactions
  WHERE store_id = v_store
    AND notes LIKE 'DEMO_SEED%';

  DELETE FROM customers
  WHERE store_id = v_store
    AND notes LIKE 'DEMO_SEED%';

  RAISE NOTICE 'Cleared existing demo data.';

  -- ── 2. Re-create customers ──────────────────────────────────────────────
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Sharma ji',    '9829011111', 'regular',   5000, 0, 'DEMO_SEED')
    RETURNING id INTO c_sharma;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Verma ji',     '9829022222', 'regular',   5000, 0, 'DEMO_SEED')
    RETURNING id INTO c_verma;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Gupta ji',     '9829033333', 'regular',   8000, 0, 'DEMO_SEED')
    RETURNING id INTO c_gupta;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Meena Devi',   '9829044444', 'regular',   3000, 0, 'DEMO_SEED')
    RETURNING id INTO c_meena;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Saini Traders','9829055555', 'wholesale', 20000, 0, 'DEMO_SEED')
    RETURNING id INTO c_saini;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Bajaj Medicals','9829077777', 'wholesale', 30000, 0, 'DEMO_SEED')
    RETURNING id INTO c_bajaj;

  -- ── 3. SOURCE CYCLE used for all sale generate_series blocks ───────────
  -- 9-element array: 4 quick (44%) + 3 voice (33%) + 2 scan (22%)
  -- Reference: (ARRAY['manual_quick','manual_quick','manual_quick','manual_quick',
  --                    'voice','voice','voice','bill_scan','bill_scan'])[1+(g-1)%9]

  -- ── 4. WEEK 1 (days 29-23): Getting started. Learning to tap + buttons. ─
  -- ~5-6 sales/day. No voice yet. Mix of quick and scan.
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT
    v_store, v_user,
    CURRENT_DATE - d.ago,
    'sale',
    (280 + floor(random() * 1200))::numeric,
    (ARRAY['cash','upi','upi','upi','upi'])[1 + floor(random() * 5)::int],
    (ARRAY['manual_quick','manual_quick','manual_quick','manual_quick',
           'voice','voice','voice','bill_scan','bill_scan'])[1 + (g-1) % 9],
    0, 'DEMO_SEED'
  FROM (VALUES (29,5),(28,5),(27,6),(26,5),(25,6),(24,5),(23,5)) AS d(ago, cnt)
  CROSS JOIN LATERAL generate_series(1, d.cnt) AS g;

  -- Week 1: first purchase (scanned invoice)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-27, 'purchase', 10500, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED');

  -- Week 1: one udhaar sale (Sharma ji)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-25, 'sale', 1200, 'credit', c_sharma, 'manual_quick', 0, 'DEMO_SEED');

  -- ── 5. WEEK 2 (days 22-16): Scanning bills regularly. Voice discovered. ─
  -- ~8-9 sales/day. Same 9-cycle source distribution.
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT
    v_store, v_user,
    CURRENT_DATE - d.ago,
    'sale',
    (350 + floor(random() * 1800))::numeric,
    (ARRAY['cash','upi','upi','upi','upi','upi'])[1 + floor(random() * 6)::int],
    (ARRAY['manual_quick','manual_quick','manual_quick','manual_quick',
           'voice','voice','voice','bill_scan','bill_scan'])[1 + (g-1) % 9],
    0, 'DEMO_SEED'
  FROM (VALUES (22,7),(21,8),(20,8),(19,9),(18,8),(17,9),(16,8)) AS d(ago, cnt)
  CROSS JOIN LATERAL generate_series(1, d.cnt) AS g;

  -- Week 2: purchase + credit sales
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-20, 'purchase', 12000, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED');
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-22, 'sale', 1650, 'credit', c_verma,  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-19, 'sale', 2100, 'credit', c_gupta,  'voice',        0, 'DEMO_SEED');

  -- ── 6. WEEK 3 (days 15-9): All three methods in regular daily use. ──────
  -- ~10-12 sales/day. Same 9-cycle.
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT
    v_store, v_user,
    CURRENT_DATE - d.ago,
    'sale',
    (380 + floor(random() * 2200))::numeric,
    (ARRAY['cash','upi','upi','upi','upi','upi'])[1 + floor(random() * 6)::int],
    (ARRAY['manual_quick','manual_quick','manual_quick','manual_quick',
           'voice','voice','voice','bill_scan','bill_scan'])[1 + (g-1) % 9],
    0, 'DEMO_SEED'
  FROM (VALUES (15,10),(14,11),(13,10),(12,12),(11,11),(10,12),(9,10)) AS d(ago, cnt)
  CROSS JOIN LATERAL generate_series(1, d.cnt) AS g;

  -- Week 3: purchases + expenses + credit sales + first payment collected
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-13, 'purchase', 16500, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-10, 'purchase',  8200, 'cash', 'Shree Agencies',      'bill_scan', 0, 'DEMO_SEED');
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-12, 'expense', 1200, 'cash', 'manual_full', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-9,  'expense',  450, 'cash', 'manual_full', 0, 'DEMO_SEED');
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-15, 'sale', 1850, 'credit', c_sharma, 'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-11, 'sale',  900, 'credit', c_meena,  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-10, 'sale', 4200, 'credit', c_saini,  'bill_scan',    0, 'DEMO_SEED');
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-11, 'payment', 1000, 'upi', c_sharma, 'manual_full', 0, 'DEMO_SEED');

  -- ── 7. WEEK 4 (days 8-1): Voice fully adopted. Quick still dominant. ────
  -- ~13-16 sales/day. Same 9-cycle.
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT
    v_store, v_user,
    CURRENT_DATE - d.ago,
    'sale',
    (400 + floor(random() * 2800))::numeric,
    (ARRAY['cash','upi','upi','upi','upi','upi','upi'])[1 + floor(random() * 7)::int],
    (ARRAY['manual_quick','manual_quick','manual_quick','manual_quick',
           'voice','voice','voice','bill_scan','bill_scan'])[1 + (g-1) % 9],
    0, 'DEMO_SEED'
  FROM (VALUES (8,13),(7,14),(6,15),(5,14),(4,16),(3,15),(2,16),(1,14)) AS d(ago, cnt)
  CROSS JOIN LATERAL generate_series(1, d.cnt) AS g;

  -- Week 4: credit sales (voice and quick)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-7, 'sale', 1850, 'credit', c_sharma, 'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-6, 'sale', 2400, 'credit', c_gupta,  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  900, 'credit', c_meena,  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 1650, 'credit', c_verma,  'bill_scan',    0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 4800, 'credit', c_saini,  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 1300, 'credit', c_sharma, 'voice',        0, 'DEMO_SEED');

  -- Week 4: purchases scanned, expenses as manual_full
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-6, 'purchase', 14500, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-3, 'purchase',  9800, 'cash', 'Shree Agencies',      'bill_scan', 0, 'DEMO_SEED');
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-5, 'expense', 1200, 'cash', 'manual_full', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-4, 'expense',  450, 'cash', 'manual_full', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-2, 'expense',  600, 'cash', 'manual_full', 0, 'DEMO_SEED');

  -- Week 4: payments collected
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-3, 'payment', 1000, 'upi', c_sharma, 'manual_full', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-2, 'payment', 1500, 'upi', c_verma,  'manual_full', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-1, 'payment', 2000, 'upi', c_gupta,  'manual_full', 0, 'DEMO_SEED');

  -- ── 8. TODAY: Month-start jump. Balaji restock. Offices restocking. ─────

  -- Balaji morning delivery (scanned invoice)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'purchase', 11200, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED');

  -- Morning rush: 10 retail sales (voice + quick + scan balanced)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'sale',   55, 'upi',  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  130, 'upi',  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',   88, 'upi',  'bill_scan',    0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  450, 'upi',  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',   72, 'cash', 'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  280, 'upi',  'bill_scan',    0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  195, 'upi',  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  620, 'upi',  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',   48, 'upi',  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  365, 'upi',  'voice',        0, 'DEMO_SEED');

  -- Mid-morning: Saini Traders month-start bulk (scanned order form)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 11500, 'credit', c_saini, 'bill_scan', 0, 'DEMO_SEED');

  -- Gupta ji clears outstanding (month-start settlement)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'payment', 3200, 'upi', c_gupta, 'manual_full', 0, 'DEMO_SEED');

  -- Afternoon: 8 more strong sales
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'sale',  840, 'upi',  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  290, 'upi',  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  110, 'cash', 'bill_scan',    0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  760, 'upi',  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  195, 'upi',  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  430, 'upi',  'bill_scan',    0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  980, 'upi',  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  545, 'upi',  'manual_quick', 0, 'DEMO_SEED');

  -- Verma ji month-start udhaar
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 2200, 'credit', c_verma, 'voice', 0, 'DEMO_SEED');

  -- Evening: 4 closing sales
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'sale',  345, 'upi',  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',   92, 'upi',  'voice',        0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  580, 'upi',  'bill_scan',    0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE, 'sale',  240, 'cash', 'voice',        0, 'DEMO_SEED');

  -- Evening expense (packaging + carry bags)
  INSERT INTO transactions
    (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'expense', 650, 'cash', 'manual_full', 0, 'DEMO_SEED');

  -- ── 9. Recompute customer balances from all seeded transactions ──────────
  UPDATE customers c
  SET current_balance = COALESCE((
    SELECT SUM(
      CASE
        WHEN t.type = 'sale' AND t.payment_method = 'credit' THEN t.total_amount
        WHEN t.type = 'payment' THEN -t.total_amount
        ELSE 0
      END
    )
    FROM transactions t
    WHERE t.customer_id = c.id
      AND t.store_id = v_store
  ), 0)
  WHERE c.store_id = v_store
    AND c.notes LIKE 'DEMO_SEED%';

  RAISE NOTICE 'Reset + reseed complete for store %.', v_store;
END $$;

-- ── Verify: source distribution (should be ~44% quick / 33% voice / 22% scan / 3% full)
SELECT
  source,
  count(*)                                                   AS cnt,
  round(100.0 * count(*) / sum(count(*)) OVER (), 1)        AS pct
FROM transactions
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND notes LIKE 'DEMO_SEED%'
GROUP BY source
ORDER BY cnt DESC;
