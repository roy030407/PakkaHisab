-- ============================================================================
-- RAM KIRANA - GAP FILLER + TODAY SEED (June 25-30)
-- ----------------------------------------------------------------------------
-- Fills the 6 days after the main seed. Realistic kirana operation:
--   Thu: high sales, cold drink + biscuit stock runs out by evening
--   Fri: morning restock from Balaji, sales resume on those items
--   Sat: peak day, Saini wholesale order, second restock for weekend
--   Sun: busy market day, steady UPI sales
--   Mon: slow day, items running thin again, small order placed
--   Today: morning rush, new customer, Balaji delivery in afternoon
--
-- UPI is default for all retail sales. Cash only for distributor payments
-- and small expenses. Credit for known udhaar customers.
--
-- Safe to run once. Remove with:
--   DELETE FROM transactions WHERE notes LIKE 'DEMO_SEED_TODAY%';
--   DELETE FROM customers WHERE notes = 'DEMO_SEED_TODAY';
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
    RAISE EXCEPTION 'Store not found. Check the name filter.';
  END IF;

  SELECT id INTO c_saini  FROM customers WHERE store_id = v_store AND name = 'Saini Traders' LIMIT 1;
  SELECT id INTO c_sharma FROM customers WHERE store_id = v_store AND name = 'Sharma ji'     LIMIT 1;
  SELECT id INTO c_gupta  FROM customers WHERE store_id = v_store AND name = 'Gupta ji'      LIMIT 1;
  SELECT id INTO c_verma  FROM customers WHERE store_id = v_store AND name = 'Verma ji'      LIMIT 1;
  SELECT id INTO c_meena  FROM customers WHERE store_id = v_store AND name = 'Meena Devi'    LIMIT 1;

  -- New wholesale customer (walks in today for the first time)
  INSERT INTO customers (store_id, name, phone, type, credit_limit, current_balance, notes)
    VALUES (v_store, 'Bajaj Medicals', '9829077777', 'wholesale', 30000, 0, 'DEMO_SEED_TODAY')
    RETURNING id INTO c_new;

  -- ============================================================
  -- THURSDAY June 25 (CURRENT_DATE - 5)
  -- Normal weekday. Heavy morning + evening. Cold drink and
  -- biscuit stock runs low by evening - merchant notes it down.
  -- ============================================================

  -- Morning rush (8-11am): 14 small UPI sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-5, 'sale',  42, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  78, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 115, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  55, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 190, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  38, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 260, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  95, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 145, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  62, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 320, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  88, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 170, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  45, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Afternoon (12-5pm): 10 more, mix of sizes
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-5, 'sale', 430, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  72, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 510, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 125, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 285, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  58, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 640, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 195, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  85, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 360, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- RESTOCK TRIGGER: stock running low on cold drinks + biscuits
  -- Merchant calls Balaji Distributors and places an order for morning delivery
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-5, 'purchase', 4200, 'cash', 'Balaji Distributors', 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- Evening (6-9pm): 8 sales, cold drinks moving fast before stock runs out
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-5, 'sale',  92, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 760, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 315, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  48, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 225, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 140, 'upi',  'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale', 390, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-5, 'sale',  75, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Thu: Gupta ji takes on credit
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-5, 'sale', 1450, 'credit', c_gupta, 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Thu: transport expense (auto for delivery pickup)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-5, 'expense', 120, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ============================================================
  -- FRIDAY June 26 (CURRENT_DATE - 4)
  -- Balaji delivers in the morning (cold drinks + biscuits restocked).
  -- Sales pick up again once stock arrives. Shree Agencies
  -- delivers a second batch in the afternoon (staples + oil).
  -- Busy end-of-week.
  -- ============================================================

  -- Balaji morning delivery (restock: cold drinks, biscuits, chips)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-4, 'purchase', 8600, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_TODAY');

  -- Morning (9-11am): 12 sales, cold drinks flying again after restock
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-4, 'sale',  55, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 110, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  42, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 230, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  78, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 155, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 310, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  66, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 480, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 225, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  92, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 560, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Shree Agencies afternoon delivery (staples: atta, oil, sugar, dal)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-4, 'purchase', 9500, 'cash', 'Shree Agencies', 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- Afternoon + evening (12-9pm): 14 more sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-4, 'sale', 690, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 415, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  85, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 340, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 880, 'upi',  'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  52, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 720, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 175, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 260, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 495, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 835, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale',  68, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 130, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-4, 'sale', 370, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Fri: Verma ji credit sale
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-4, 'sale', 1850, 'credit', c_verma, 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ============================================================
  -- SATURDAY June 27 (CURRENT_DATE - 3)
  -- Peak day. Morning market + afternoon families. Saini Traders
  -- big bulk order. Items selling fast - evening restock order placed.
  -- ============================================================

  -- Morning rush (8-12pm): 18 small sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-3, 'sale',  48, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 110, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 210, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  72, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 375, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 590, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  95, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 445, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 155, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 780, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  62, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 320, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 650, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 290, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  44, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 910, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 475, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 185, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ANOMALY: Saini Traders big Saturday bulk order (wholesale spike)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-3, 'sale', 9200, 'credit', c_saini, 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- Afternoon + evening (2-9pm): 14 more sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-3, 'sale', 560, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',1100, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 380, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 840, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  78, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 235, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 670, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 120, 'upi',  'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 455, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  55, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 310, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 725, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale', 180, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-3, 'sale',  92, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Evening restock: staples running low, order placed for Sunday delivery
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-3, 'purchase', 13800, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_TODAY');

  -- Sat: Verma ji repays some udhaar
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-3, 'sale',  2100, 'credit', c_meena,  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ============================================================
  -- SUNDAY June 28 (CURRENT_DATE - 2)
  -- Sunday market day. Fresh stock from Saturday restock.
  -- Families shopping for the week. Very busy afternoon.
  -- ============================================================

  -- Morning (9-12pm): 16 sales, fresh stock selling well
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-2, 'sale',  62, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 165, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 290, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  48, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 540, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 380, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 720, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  85, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 455, 'upi',  'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 310, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  58, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 860, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 195, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 625, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 430, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  95, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Afternoon (2-6pm): 12 more - families stocking up for the week
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-2, 'sale', 780, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 255, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 940, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  72, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 520, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 345, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 680, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 115, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 435, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale',  55, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 825, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'sale', 190, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Sun: Meena credit sale + Sharma repays
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-2, 'sale',   1350, 'credit', c_meena,  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-2, 'payment', 2000, 'upi',  c_sharma, 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ============================================================
  -- MONDAY June 29 (CURRENT_DATE - 1)
  -- ANOMALY: Slow Monday. Low footfall after weekend. Some items
  -- running thin (oil, sugar, soap). Merchant places a small
  -- top-up order with Shree Agencies for Tuesday delivery.
  -- ============================================================

  -- Slow day: only 10 sales, smaller amounts
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-1, 'sale',  88, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 145, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  42, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 310, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 265, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  75, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 420, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 190, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale',  55, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE-1, 'sale', 380, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Mon: small top-up order placed (oil, sugar, soap stock low)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-1, 'purchase', 5400, 'cash', 'Shree Agencies', 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- Mon: electricity bill expense
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE-1, 'expense', 1200, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ============================================================
  -- TODAY June 30 (CURRENT_DATE)
  -- Shree Agencies delivers the top-up order this morning.
  -- Month-end: Saini Traders places another bulk order.
  -- New wholesale customer (Bajaj Medicals) walks in.
  -- Sales building up through the day.
  -- ============================================================

  -- Shree Agencies delivers (top-up: oil, sugar, soap restocked)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'purchase', 5400, 'cash', 'Shree Agencies', 'bill_scan', 0, 'DEMO_SEED_TODAY');

  -- Morning (9-12pm): 14 sales, fresh stock moving well
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale',  48, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 120, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  85, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 310, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  62, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 220, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 175, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 480, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  92, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 560, 'upi',  'voice',        0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 140, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 320, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  55, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 710, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- ANOMALY: month-end Saini Traders big order
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 8750, 'credit', c_saini, 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- New customer: Bajaj Medicals first order
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 3400, 'credit', c_new, 'manual_full', 0, 'DEMO_SEED_TODAY');

  -- Afternoon (1-5pm): 10 more sales
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'sale', 390, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  78, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 650, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 215, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  45, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 895, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 155, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 440, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale',  68, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY'),
    (v_store, v_user, CURRENT_DATE, 'sale', 275, 'upi',  'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Sharma pays udhaar (end of month)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'payment', 2500, 'upi', c_sharma, 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Today: misc expense (packaging material)
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes) VALUES
    (v_store, v_user, CURRENT_DATE, 'expense', 850, 'cash', 'manual_quick', 0, 'DEMO_SEED_TODAY');

  -- Set new customer's opening balance
  UPDATE customers SET current_balance = 3400 WHERE id = c_new;

  RAISE NOTICE 'Gap filler complete for store % - June 25-30 loaded with restock cycles.', v_store;
END $$;

-- Verify totals:
-- SELECT date, type, count(*) as txns, sum(total_amount) as total
-- FROM transactions
-- WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--   AND notes LIKE 'DEMO_SEED_TODAY%'
-- GROUP BY date, type ORDER BY date, type;
