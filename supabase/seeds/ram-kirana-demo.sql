-- ============================================================================
-- RAM KIRANA - DEMO / PREVIEW SEED  (NOT real merchant activity)
-- ----------------------------------------------------------------------------
-- WHAT THIS IS:
--   A four-week, dated set of demo transactions + a few customers, so the
--   dashboard and Reports trend graphs have something to show. This is a
--   PREVIEW of what the app looks like after a month of use. It is NOT the
--   shopkeeper's real activity - do not present it to the panel as his real
--   usage. Get his genuine days for that; this is only to demo the UI.
--
-- WHAT IT IS NOT:
--   It does not add products. Load the real catalog first:
--   Settings -> Sample Templates -> "Kirana Store" (then edit to his stock).
--   Transactions here are totals-only (no line items), which is enough for the
--   dashboard totals, the cash-flow / sales-vs-purchases trend, and the udhaar
--   collections card. "Top products" will stay sparse (no item-level rows).
--
-- PRODUCTIVITY TREND:
--   Week 1 (days 22-28 ago): ~5 txns/day, lower amounts, getting started
--   Week 2 (days 15-21 ago): ~8 txns/day, more regular, first purchase entry
--   Week 3 (days  8-14 ago): ~11 txns/day, consistent, bill scanning added
--   Week 4 (days  1-7  ago): ~14 txns/day, peak - full feature adoption
--   This mirrors real adoption: merchant learns the app over 4 weeks.
--
-- HOW TO RUN:
--   1) Make sure Ram Kirana has signed up + completed onboarding (a stores row
--      exists). Confirm the store NAME below matches (edit the WHERE filter).
--   2) Paste this whole file into the Supabase SQL editor and run ONCE.
--      (Re-running duplicates rows - clear first with the cleanup at the bottom.)
--
-- HOW TO REMOVE (clean slate):
--   DELETE FROM transactions
--     WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--       AND notes = 'DEMO_SEED';
--   DELETE FROM customers
--     WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--       AND notes = 'DEMO_SEED';
-- ============================================================================

DO $$
DECLARE
  v_store text;
  v_user  text;
  c_sharma text;
  c_verma  text;
  c_gupta  text;
  c_meena  text;
  c_saini  text;
BEGIN
  -- 1) Resolve the store (edit the name filter if needed) ---------------------
  SELECT id, owner_id INTO v_store, v_user
  FROM stores
  WHERE name ILIKE '%ram kirana%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_store IS NULL THEN
    RAISE EXCEPTION 'No store matching "ram kirana" found. Edit the WHERE filter to the exact store name.';
  END IF;

  -- 2) Customers (for the udhaar / collections demo) --------------------------
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Sharma ji',    '9829011111', 'regular',   5000, 0, 'DEMO_SEED') RETURNING id INTO c_sharma;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Verma ji',     '9829022222', 'regular',   5000, 0, 'DEMO_SEED') RETURNING id INTO c_verma;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Gupta ji',     '9829033333', 'regular',   8000, 0, 'DEMO_SEED') RETURNING id INTO c_gupta;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Meena Devi',   '9829044444', 'regular',   3000, 0, 'DEMO_SEED') RETURNING id INTO c_meena;
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Saini Traders','9829055555', 'wholesale',20000, 0, 'DEMO_SEED') RETURNING id INTO c_saini;

  -- 3) WEEK 1 (days 22-28 ago): Getting started. Fewer txns, smaller amounts.
  --    Merchant is learning; mostly cash, one credit sale. No purchases yet.
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT v_store, v_user,
         CURRENT_DATE - days.d,
         'sale',
         (280 + floor(random() * 1400))::numeric,
         (ARRAY['cash','cash','cash','cash','upi'])[1 + floor(random() * 5)::int],
         'manual_quick', 0, 'DEMO_SEED'
  FROM (VALUES (28,4),(27,5),(26,4),(25,5),(24,6),(23,5)) AS days(d, n)
  CROSS JOIN LATERAL generate_series(1, days.n) g;

  -- Week 1: one credit sale (first udhaar tracked)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-26, 'sale', 1200, 'credit', c_sharma, 'manual_quick', 0, 'DEMO_SEED');

  -- 4) WEEK 2 (days 15-21 ago): Ramping up. More txns, first purchase entry.
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT v_store, v_user,
         CURRENT_DATE - days.d,
         'sale',
         (320 + floor(random() * 1800))::numeric,
         (ARRAY['cash','cash','cash','upi','upi'])[1 + floor(random() * 5)::int],
         'manual_quick', 0, 'DEMO_SEED'
  FROM (VALUES (21,7),(20,8),(19,7),(18,8),(17,9),(16,8)) AS days(d, n)
  CROSS JOIN LATERAL generate_series(1, days.n) g;

  -- Week 2: first purchase entry + more udhaar
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-19, 'purchase', 12000, 'cash', 'Balaji Distributors', 'manual_full', 0, 'DEMO_SEED');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-21, 'sale', 1650, 'credit', c_verma,  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-18, 'sale', 2100, 'credit', c_gupta,  'manual_quick', 0, 'DEMO_SEED');

  -- 5) WEEK 3 (days 8-14 ago): Consistent use. Bill scanning added. Expenses tracked.
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT v_store, v_user,
         CURRENT_DATE - days.d,
         'sale',
         (350 + floor(random() * 2200))::numeric,
         (ARRAY['cash','cash','cash','upi','upi'])[1 + floor(random() * 5)::int],
         (ARRAY['manual_quick','manual_quick','manual_quick','bill_scan'])[1 + floor(random() * 4)::int],
         0, 'DEMO_SEED'
  FROM (VALUES (14,10),(13,11),(12,10),(11,12),(10,11),(9,12),(8,11)) AS days(d, n)
  CROSS JOIN LATERAL generate_series(1, days.n) g;

  -- Week 3: purchases + expenses + more udhaar
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-12, 'purchase', 16500, 'cash', 'Balaji Distributors', 'bill_scan',    0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-9,  'purchase',  8200, 'cash', 'Shree Agencies',      'manual_full',  0, 'DEMO_SEED');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-11, 'expense', 1200, 'cash', 'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-8,  'expense',  450, 'cash', 'manual_quick', 0, 'DEMO_SEED');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-14, 'sale', 1850, 'credit', c_sharma, 'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-10, 'sale',  900, 'credit', c_meena,  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-9,  'sale', 4200, 'credit', c_saini,  'manual_full',  0, 'DEMO_SEED');
  -- Week 3: first repayment collected
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-10, 'payment', 1000, 'cash', c_sharma, 'manual_quick', 0, 'DEMO_SEED');

  -- 6) WEEK 4 / current week (days 1-7 ago): Peak adoption. Full feature use.
  --    Higher txn counts, voice entry mixed in, scanned bills every other day.
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  SELECT v_store, v_user,
         CURRENT_DATE - days.d,
         'sale',
         (350 + floor(random() * 2600))::numeric,
         (ARRAY['cash','cash','cash','cash','upi','upi'])[1 + floor(random() * 6)::int],
         (ARRAY['manual_quick','manual_quick','bill_scan','voice'])[1 + floor(random() * 4)::int],
         0, 'DEMO_SEED'
  FROM (VALUES (6,12),(5,11),(4,13),(3,12),(2,14),(1,16),(0,15)) AS days(d, n)
  CROSS JOIN LATERAL generate_series(1, days.n) g;

  -- Week 4: credit sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-6, 'sale', 1850, 'credit', c_sharma, 'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 2400, 'credit', c_gupta,  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  900, 'credit', c_meena,  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 1650, 'credit', c_verma,  'manual_full',  0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 4200, 'credit', c_saini,  'manual_full',  0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 1300, 'credit', c_sharma, 'manual_quick', 0, 'DEMO_SEED');
  -- Week 4: purchases + expenses
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-5, 'purchase', 14500, 'cash', 'Balaji Distributors', 'manual_full', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-2, 'purchase',  9800, 'cash', 'Shree Agencies',      'manual_full', 0, 'DEMO_SEED');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-4, 'expense', 1200, 'cash', 'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-3, 'expense',  450, 'cash', 'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-1, 'expense',  600, 'cash', 'manual_quick', 0, 'DEMO_SEED');
  -- Week 4: repayments collected
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-2, 'payment', 1000, 'cash', c_sharma, 'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE-1, 'payment', 1500, 'upi',  c_verma,  'manual_quick', 0, 'DEMO_SEED'),
    (v_store, v_user, CURRENT_DATE,   'payment', 2000, 'cash', c_gupta,  'manual_quick', 0, 'DEMO_SEED');

  -- 7) Recompute each customer's balance from all credit sales minus all payments
  UPDATE customers c
  SET current_balance = COALESCE((
        SELECT SUM(CASE
                     WHEN t.type = 'sale' AND t.payment_method = 'credit' THEN t.total_amount
                     WHEN t.type = 'payment' THEN -t.total_amount
                     ELSE 0 END)
        FROM transactions t
        WHERE t.customer_id = c.id
      ), 0)
  WHERE c.store_id = v_store AND c.notes = 'DEMO_SEED';

  RAISE NOTICE 'Ram Kirana demo seed complete for store % - 4 weeks of data loaded', v_store;
END $$;

-- Quick sanity check after running:
-- SELECT date, type, count(*), sum(total_amount)
-- FROM transactions
-- WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%') AND notes='DEMO_SEED'
-- GROUP BY date, type ORDER BY date;
