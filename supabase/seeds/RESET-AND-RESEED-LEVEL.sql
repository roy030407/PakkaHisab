-- ============================================================================
-- RESET AND RESEED (LEVEL) - Ram Kirana labeled sample data, day 1 -> today
-- ============================================================================
-- THIS IS THE AUTHORITATIVE SEED SCRIPT. It supersedes RESET-AND-RESEED.sql
-- and ram-kirana-jul2-10.sql (both now deprecated - see their headers).
--
-- WHY THIS EXISTS:
--   The old RESET-AND-RESEED.sql had an intentional 4-week adoption RAMP
--   (5/day -> 8/day -> 11/day -> 14/day), which is exactly the "steep change"
--   pattern that reads as suspicious in a usage chart. This script generates
--   a CONSISTENT daily level from the store's join date through today instead
--   - no upward or downward trend, only a mild, realistic weekend bump.
--
-- WHAT THIS IS:
--   Labeled sample data (notes = 'DEMO_SEED_LEVEL' on every row) so the
--   dashboard has a full, evenly-used history to demo. The app's evidence
--   surfaces (usage banner, Merchant Activity card, PostHog) exclude
--   DEMO_SEED* rows automatically - this script does not touch that.
--
-- SHAPE:
--   - Runs from the store's created_at date through CURRENT_DATE (recomputed
--     every time you run it, so it always reaches "today").
--   - Weekday: 10-13 sales/day. Weekend (Sat/Sun): 14-18 sales/day.
--     That is the only intentional spike - flat otherwise, day to day.
--   - Sale source mix: ~40% voice, ~30% bill_scan, ~30% manual_quick.
--     manual_full is NOT used for sales (only expenses/payments), matching
--     "barely any through the normal Full Entry button."
--   - Times cluster morning (8-11am) and evening (5-10pm), matching a
--     kirana's real rush hours.
--   - Periodic purchases (bill_scan, every ~5 days) and expenses
--     (manual_full, every ~5-6 days) layered on top.
--   - A handful of udhaar (credit) sales and payment collections tied to
--     the existing demo customers.
--
-- RUN: paste into Supabase SQL editor, run ONCE (deletes + reinserts all
-- DEMO_SEED*-tagged rows, so it is safe to re-run any time).
-- ============================================================================

DO $$
DECLARE
  v_store      text;
  v_user       text;
  v_join_date  date;
  c_sharma     text;
  c_verma      text;
  c_gupta      text;
  c_meena      text;
  c_saini      text;
  c_bajaj      text;
BEGIN

  -- ── 0. Find the store ───────────────────────────────────────────────────
  SELECT id, owner_id, created_at::date INTO v_store, v_user, v_join_date
  FROM stores
  WHERE name ILIKE '%ram kirana%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_store IS NULL THEN
    RAISE EXCEPTION 'No store matching "ram kirana" found.';
  END IF;

  RAISE NOTICE 'Found store: % (joined %)', v_store, v_join_date;

  -- ── 1. Delete ALL existing demo seed data (any tag, safe to re-run) ────
  DELETE FROM transactions
  WHERE store_id = v_store
    AND notes LIKE 'DEMO_SEED%';

  DELETE FROM customers
  WHERE store_id = v_store
    AND notes LIKE 'DEMO_SEED%';

  RAISE NOTICE 'Cleared existing demo data.';

  -- ── 2. Re-create customers ──────────────────────────────────────────────
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Sharma ji',    '9829011111', 'regular',   5000, 0, 'DEMO_SEED_LEVEL')
    RETURNING id INTO c_sharma;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Verma ji',     '9829022222', 'regular',   5000, 0, 'DEMO_SEED_LEVEL')
    RETURNING id INTO c_verma;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Gupta ji',     '9829033333', 'regular',   8000, 0, 'DEMO_SEED_LEVEL')
    RETURNING id INTO c_gupta;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Meena Devi',   '9829044444', 'regular',   3000, 0, 'DEMO_SEED_LEVEL')
    RETURNING id INTO c_meena;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Saini Traders','9829055555', 'wholesale', 20000, 0, 'DEMO_SEED_LEVEL')
    RETURNING id INTO c_saini;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Bajaj Medicals','9829077777', 'wholesale', 30000, 0, 'DEMO_SEED_LEVEL')
    RETURNING id INTO c_bajaj;

  -- ── 3. Daily retail sales: flat level, weekend bump, no trend ───────────
  -- Weekday 10-13/day, weekend (Sat=6, Sun=0) 14-18/day. Source mix per row:
  -- 4 voice + 3 bill_scan + 3 manual_quick (40/30/30). Times cluster
  -- 8-11am and 5-10pm. Amounts 60-910.
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at)
  SELECT
    v_store, v_user, d::date, 'sale',
    (60 + floor(random() * 850))::numeric,
    (ARRAY['upi','upi','upi','upi','cash'])[1 + floor(random() * 5)::int],
    (ARRAY['voice','voice','voice','voice','bill_scan','bill_scan','bill_scan','manual_quick','manual_quick','manual_quick'])[1 + floor(random() * 10)::int],
    0, 'DEMO_SEED_LEVEL',
    d::date + make_interval(
      hours => (CASE WHEN random() < 0.5 THEN 8 + floor(random() * 4) ELSE 17 + floor(random() * 5) END)::int,
      mins  => floor(random() * 60)::int
    )
  FROM generate_series(v_join_date, CURRENT_DATE, interval '1 day') AS d
  CROSS JOIN LATERAL generate_series(1, (
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6)
         THEN 14 + floor(random() * 5)::int   -- weekend: 14-18
         ELSE 10 + floor(random() * 4)::int   -- weekday: 10-13
    END
  )) AS g;

  -- ── 4. Periodic supplier purchases (scanned invoices, every ~5 days) ────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes, created_at)
  SELECT
    v_store, v_user, d::date, 'purchase',
    (6000 + floor(random() * 9000))::numeric,
    'cash',
    (ARRAY['Balaji Distributors','Balaji Distributors','Shree Agencies'])[1 + floor(random() * 3)::int],
    'bill_scan', 0, 'DEMO_SEED_LEVEL',
    d::date + make_interval(hours => (9 + floor(random() * 5))::int, mins => floor(random() * 60)::int)
  FROM generate_series(v_join_date, CURRENT_DATE, interval '5 days') AS d;

  -- ── 5. Periodic expenses (manual_full, every ~5-6 days) ─────────────────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at)
  SELECT
    v_store, v_user, d::date, 'expense',
    (300 + floor(random() * 700))::numeric,
    'cash', 'manual_full', 0, 'DEMO_SEED_LEVEL',
    d::date + make_interval(hours => (18 + floor(random() * 4))::int, mins => floor(random() * 60)::int)
  FROM generate_series(v_join_date + 2, CURRENT_DATE, interval '6 days') AS d;

  -- ── 6. Udhaar (credit) sales spread across the range ─────────────────────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes, created_at)
  SELECT
    v_store, v_user, d::date, 'sale',
    (800 + floor(random() * 4500))::numeric,
    'credit',
    (ARRAY[c_sharma, c_verma, c_gupta, c_meena, c_saini])[1 + floor(random() * 5)::int],
    (ARRAY['voice','voice','bill_scan','manual_quick'])[1 + floor(random() * 4)::int],
    0, 'DEMO_SEED_LEVEL',
    d::date + make_interval(hours => (11 + floor(random() * 9))::int, mins => floor(random() * 60)::int)
  FROM generate_series(v_join_date + 3, CURRENT_DATE, interval '4 days') AS d;

  -- ── 7. Payment collections against outstanding credit ────────────────────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes, created_at)
  SELECT
    v_store, v_user, d::date, 'payment',
    (500 + floor(random() * 2500))::numeric,
    'upi',
    (ARRAY[c_sharma, c_verma, c_gupta])[1 + floor(random() * 3)::int],
    'manual_full', 0, 'DEMO_SEED_LEVEL',
    d::date + make_interval(hours => (12 + floor(random() * 8))::int, mins => floor(random() * 60)::int)
  FROM generate_series(v_join_date + 6, CURRENT_DATE, interval '7 days') AS d;

  -- ── 8. Recompute customer balances from all seeded transactions ─────────
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
    AND c.notes = 'DEMO_SEED_LEVEL';

  RAISE NOTICE 'Level reseed complete for store % (% through %).', v_store, v_join_date, CURRENT_DATE;
END $$;

-- ── Verify: per-day sale counts (should be flat, no ramp; weekend slightly higher)
-- SELECT date, count(*) FILTER (WHERE type = 'sale') AS sales,
--        sum(total_amount) FILTER (WHERE type = 'sale') AS revenue
-- FROM transactions
-- WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--   AND notes = 'DEMO_SEED_LEVEL'
-- GROUP BY date ORDER BY date;

-- ── Verify: source distribution (target ~40% voice / 30% scan / 30% quick)
-- SELECT source, count(*) AS cnt, round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
-- FROM transactions
-- WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--   AND notes = 'DEMO_SEED_LEVEL' AND type = 'sale'
-- GROUP BY source ORDER BY cnt DESC;
