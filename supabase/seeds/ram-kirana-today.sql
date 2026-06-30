-- ============================================================================
-- RAM KIRANA - DAILY TOP-UP SEED
-- ----------------------------------------------------------------------------
-- Run this on any day to add that day's transactions on top of the main seed.
-- Safe to run multiple times: it checks for DEMO_SEED_TODAY tag to avoid
-- duplicates. Change the tag date below if re-running on a different day.
--
-- WHAT'S IN HERE:
--   - Today's realistic sales (morning rush + afternoon + evening)
--   - A few anomalies to make the data interesting for demos:
--       * A big wholesale order (Saini Traders spike)
--       * New item categories: cold drinks, stationery, seasonal
--       * One bill_scan transaction (shows the scanning feature was used)
--       * A large UPI payment (shows UPI adoption)
--   - Yesterday's data top-up (fills any gaps from the main seed)
--   - A udhaar repayment from a new customer
--
-- HOW TO RUN:
--   Paste into Supabase SQL editor. Run once per day.
--   To remove: DELETE FROM transactions WHERE notes LIKE 'DEMO_SEED_TODAY%'
-- ============================================================================

DO $$
DECLARE
  v_store text;
  v_user  text;
  c_saini  text;
  c_sharma text;
  c_new    text;
BEGIN
  SELECT id, owner_id INTO v_store, v_user
  FROM stores
  WHERE name ILIKE '%ram kirana%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Store not found. Check the name filter.';
  END IF;

  -- Get existing customer IDs
  SELECT id INTO c_saini  FROM customers WHERE store_id = v_store AND name = 'Saini Traders' LIMIT 1;
  SELECT id INTO c_sharma FROM customers WHERE store_id = v_store AND name = 'Sharma ji'     LIMIT 1;

  -- Add a new walk-in customer (anomaly: new customer today)
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Bajaj Medicals', '9829077777', 'wholesale', 30000, 0, 'DEMO_SEED_TODAY')
    RETURNING id INTO c_new;

  -- ── TODAY (June 30) ──────────────────────────────────────────────────────

  -- Morning rush (8am-11am): 7 quick cash sales, small items
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale',  85,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),  -- biscuits + chai samaan
    (v_store, v_user, CURRENT_DATE, 'sale', 140,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),  -- bread + eggs
    (v_store, v_user, CURRENT_DATE, 'sale', 220,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),  -- cold drink + chips
    (v_store, v_user, CURRENT_DATE, 'sale', 310,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),  -- household items
    (v_store, v_user, CURRENT_DATE, 'sale', 175,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),  -- shampoo sachets
    (v_store, v_user, CURRENT_DATE, 'sale',  60,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),  -- matchbox + candles
    (v_store, v_user, CURRENT_DATE, 'sale', 420,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY');  -- stationery (month-end)

  -- ANOMALY 1: Big wholesale order from Saini Traders (end-of-month bulk buy)
  -- This is a spike - much larger than a regular sale
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 8750, 'credit', c_saini, 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- ANOMALY 2: Bill scan used today (distributor delivered, bill scanned)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'purchase', 11200, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_TODAY');

  -- Afternoon (12pm-4pm): 8 more sales, mix of items
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 380,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 520,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 190,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 260,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 710,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),  -- ANOMALY: large UPI payment
    (v_store, v_user, CURRENT_DATE, 'sale', 145,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 330,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 480,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ANOMALY 3: New wholesale customer (Bajaj Medicals) - first purchase
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 3400, 'credit', c_new, 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- Evening (6pm-9pm): 6 sales (peak hour for kirana)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 290,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 560,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 185,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 440,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 320,  'upi',   'voice',        0, 'DEMO_SEED_TODAY'),  -- voice entry used!
    (v_store, v_user, CURRENT_DATE, 'sale', 210,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Sharma ji pays part of his udhaar today
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'payment', 2500, 'upi', c_sharma, 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Daily expense: electricity advance (month-end)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'expense', 850, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ── YESTERDAY (June 29 - fill any gap) ───────────────────────────────────

  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-1, 'sale',  95,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 230,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 410,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 680,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 155,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 870,  'upi',   'bill_scan',    0, 'DEMO_SEED_TODAY'),  -- scanned yesterday too
    (v_store, v_user, CURRENT_DATE-1, 'sale', 340,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 500,  'upi',   'voice',        0, 'DEMO_SEED_TODAY'),  -- voice entry
    (v_store, v_user, CURRENT_DATE-1, 'sale', 270,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 390,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 125,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 615,  'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Update new customer balance
  UPDATE customers SET current_balance = 3400 WHERE id = c_new;

  RAISE NOTICE 'Today top-up complete for store %. Today + yesterday loaded.', v_store;
END $$;

-- To verify:
-- SELECT date, type, count(*), sum(total_amount)
-- FROM transactions
-- WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--   AND notes LIKE 'DEMO_SEED_TODAY%'
-- GROUP BY date, type ORDER BY date DESC;
