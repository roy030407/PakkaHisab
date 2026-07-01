-- ============================================================================
-- RAM KIRANA - JULY 1 (Tuesday, month-start)
-- ----------------------------------------------------------------------------
-- Month-start sales jump. Balaji Distributors delivers restocked cold drinks.
-- Office reopens after Monday slowdown. Families + offices restocking.
-- Gupta ji pays outstanding credit. New wholesale inquiry from Meena Medicals.
--
-- Run this directly in Supabase SQL editor.
-- Remove with: DELETE FROM transactions WHERE notes = 'DEMO_SEED_JULY1';
-- ============================================================================

DO $$
DECLARE
  v_store  text;
  v_user   text;
  c_saini  text;
  c_sharma text;
  c_gupta  text;
  c_verma  text;
  c_meena  text;
BEGIN
  SELECT id, owner_id INTO v_store, v_user
  FROM stores WHERE name ILIKE '%ram kirana%'
  ORDER BY created_at DESC LIMIT 1;
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Store not found. Check the name filter.';
  END IF;

  SELECT id INTO c_saini  FROM customers WHERE store_id = v_store AND name = 'Saini Traders' LIMIT 1;
  SELECT id INTO c_sharma FROM customers WHERE store_id = v_store AND name = 'Sharma ji'     LIMIT 1;
  SELECT id INTO c_gupta  FROM customers WHERE store_id = v_store AND name = 'Gupta ji'      LIMIT 1;
  SELECT id INTO c_verma  FROM customers WHERE store_id = v_store AND name = 'Verma ji'      LIMIT 1;
  SELECT id INTO c_meena  FROM customers WHERE store_id = v_store AND name = 'Meena Devi'    LIMIT 1;

  -- ============================================================
  -- TUESDAY July 1 (month-start, sales jump)
  -- Balaji delivers restocked cold drinks + biscuits in the morning.
  -- Offices and households restocking for the new month.
  -- Best Tuesday in a month - 22 retail sales + 2 bulk orders.
  -- ============================================================

  -- Balaji morning delivery (cold drinks, biscuits, snacks for July)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'purchase', 11200, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_JULY1');

  -- Morning rush (8-11am): 10 fast sales, cold drinks + staples
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'sale',  55, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 130, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale',  88, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 450, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale',  72, 'cash', 'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 280, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 195, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 620, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale',  48, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 365, 'upi',  'voice', 0, 'DEMO_SEED_JULY1');

  -- Mid-morning (11am-1pm): Saini Traders month-start bulk order (scanned order form)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'sale', 11500, 'credit', c_saini, 'bill_scan', 0, 'DEMO_SEED_JULY1');

  -- Gupta ji clears outstanding credit (month-start settlement)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'payment', 3200, 'upi', c_gupta, 'manual_full', 0, 'DEMO_SEED_JULY1');

  -- Afternoon (1-5pm): 8 more strong sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'sale', 840, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 290, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 110, 'cash', 'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 760, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 195, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 430, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale',  65, 'upi',  'bill_scan', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 980, 'upi',  'voice', 0, 'DEMO_SEED_JULY1');

  -- Verma ji month-start udhaar sale
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'sale', 2200, 'credit', c_verma, 'voice', 0, 'DEMO_SEED_JULY1');

  -- Evening (5-9pm): 4 sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'sale', 345, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale',  92, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 580, 'upi',  'voice', 0, 'DEMO_SEED_JULY1'),
    (v_store, v_user, '2026-07-01', 'sale', 240, 'cash', 'voice', 0, 'DEMO_SEED_JULY1');

  -- Evening expense: packaging and carry bags restocked
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, '2026-07-01', 'expense', 650, 'cash', 'manual_full', 0, 'DEMO_SEED_JULY1');

  RAISE NOTICE 'July 1 seed complete for store % - 22 retail sales + Saini bulk + Balaji restock.', v_store;
END $$;

-- Verify:
-- SELECT type, source, count(*), sum(total_amount)
-- FROM transactions
-- WHERE notes = 'DEMO_SEED_JULY1'
-- GROUP BY type, source ORDER BY type, count(*) DESC;
