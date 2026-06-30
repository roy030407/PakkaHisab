-- ============================================================================
-- RAM KIRANA - GAP FILLER + TODAY SEED
-- ----------------------------------------------------------------------------
-- Fills June 25-30 (the 6 days after the main seed was last run).
-- Safe to run once. To remove: DELETE FROM transactions WHERE notes LIKE 'DEMO_SEED_TODAY%'
--
-- Pattern: Thu-Fri moderate, Sat-Sun busy (weekend market), Mon quiet, Tue builds.
-- Anomalies: Sat wholesale spike, Sun festival rush, Mon slow day, Today bill scan.
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
  c_new    text;
BEGIN
  SELECT id, owner_id INTO v_store, v_user
  FROM stores WHERE name ILIKE '%ram kirana%'
  ORDER BY created_at DESC LIMIT 1;
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Store not found.';
  END IF;

  SELECT id INTO c_saini  FROM customers WHERE store_id = v_store AND name = 'Saini Traders' LIMIT 1;
  SELECT id INTO c_sharma FROM customers WHERE store_id = v_store AND name = 'Sharma ji'     LIMIT 1;
  SELECT id INTO c_gupta  FROM customers WHERE store_id = v_store AND name = 'Gupta ji'      LIMIT 1;
  SELECT id INTO c_verma  FROM customers WHERE store_id = v_store AND name = 'Verma ji'      LIMIT 1;
  SELECT id INTO c_meena  FROM customers WHERE store_id = v_store AND name = 'Meena Devi'    LIMIT 1;

  -- New wholesale customer walks in today
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Bajaj Medicals', '9829077777', 'wholesale', 30000, 3400, 'DEMO_SEED_TODAY')
    RETURNING id INTO c_new;

  -- ── THURSDAY June 25 (CURRENT_DATE - 5): Normal weekday ─────────────────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-5, 'sale',  120, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  280, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  350, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  195, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  430, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  510, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  270, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  640, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  185, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  390, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  760, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  315, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Thu: credit sale
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE-5, 'sale', 1450, 'credit', c_gupta, 'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Thu: expense (transport)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE-5, 'expense', 350, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ── FRIDAY June 26 (CURRENT_DATE - 4): Busier, end-of-week ──────────────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-4, 'sale',  155, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  310, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  480, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  225, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  560, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  690, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  415, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  880, 'upi',   'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  340, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  720, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  495, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  260, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  835, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  175, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Fri: distributor purchase
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE-4, 'purchase', 9500, 'cash', 'Shree Agencies', 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- ── SATURDAY June 27 (CURRENT_DATE - 3): ANOMALY - weekend peak + wholesale spike ──
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-3, 'sale',  210, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  375, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  590, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  445, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  780, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  320, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  650, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  290, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  910, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  475, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  560, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  1100,'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  380, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  840, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  235, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  670, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Sat ANOMALY: big Saini Traders order (end-of-week bulk)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-3, 'sale', 9200, 'credit', c_saini,  'manual_full',  0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 2100, 'credit', c_verma,  'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Sat: scanned a bill
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE-3, 'purchase', 13800, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_TODAY');

  -- ── SUNDAY June 28 (CURRENT_DATE - 2): Sunday market, busy ──────────────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-2, 'sale',  165, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  290, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  540, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  380, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  720, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  455, 'upi',   'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  310, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  860, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  195, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  625, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  430, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  780, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  255, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  940, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Sun: Sharma repays udhaar
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE-2, 'payment', 2000, 'cash', c_sharma, 'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Sun: Meena credit sale
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE-2, 'sale', 1350, 'credit', c_meena, 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ── MONDAY June 29 (CURRENT_DATE - 1): ANOMALY - slow Monday ────────────
  -- Mondays are typically quiet at kirana stores (weekend stock depleted, less footfall)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE-1, 'sale',  95,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  180, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  310, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  145, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  420, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  265, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  190, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  380, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Mon: expense (electricity)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE-1, 'expense', 1200, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ── TODAY June 30 (CURRENT_DATE): Morning + afternoon, still going ───────
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'sale',  85,  'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  140, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  220, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  310, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  175, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  480, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  560, 'upi',   'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  320, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  710, 'upi',   'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  390, 'cash',  'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Today ANOMALY: new wholesale customer first order
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 3400, 'credit', c_new, 'manual_full', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 8750, 'credit', c_saini, 'manual_full', 0, 'DEMO_SEED_TODAY');
  -- Today: bill scanned (distributor delivery)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE, 'purchase', 11200, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_TODAY');
  -- Today: Sharma pays
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE, 'payment', 2500, 'upi', c_sharma, 'manual_quick', 0, 'DEMO_SEED_TODAY');
  -- Today: misc expense
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes)
  VALUES (v_store, v_user, CURRENT_DATE, 'expense', 850, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Update new customer balance
  UPDATE customers SET current_balance = 3400 + 8750 WHERE id = c_new;

  RAISE NOTICE 'Gap filler complete for store % - June 25-30 loaded.', v_store;
END $$;

-- Verify:
-- SELECT date, type, count(*), sum(total_amount) FROM transactions
-- WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--   AND notes LIKE 'DEMO_SEED_TODAY%'
-- GROUP BY date, type ORDER BY date;
