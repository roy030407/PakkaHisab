-- ============================================================================
-- RAM KIRANA - SAMPLE DATA EXTENSION: JULY 2 - JULY 10 (labeled demo data)
-- ----------------------------------------------------------------------------
-- WHAT THIS IS:
--   Continues the labeled DEMO dataset from where ram-kirana-july1.sql ended,
--   so the dashboard and charts demonstrate a fully-used product through
--   today. This is SAMPLE DATA, tagged DEMO_SEED_JULY2_10 on every row.
--
-- WHAT IT IS NOT:
--   It is NOT usage evidence. The app's evidence surfaces (usage banner,
--   Merchant Activity card, PostHog analytics) exclude DEMO_SEED* rows
--   automatically, and the submission write-up discloses that dashboard
--   totals include labeled sample data. Do not remove the tags.
--
-- SHAPE:
--   Continues the late-June trend (~12-16 sales/day). Weekend spike Sat
--   Jul 4 / Sun Jul 5. Slow Monday. Morning (8-11) and evening (17-21)
--   clusters via explicit created_at. Sales mostly voice, then quick entry,
--   then bill scan. Purchases are scanned invoices; expenses are full entry.
--
-- RUN:  paste into Supabase SQL editor, run ONCE.
-- REMOVE: DELETE FROM transactions WHERE notes = 'DEMO_SEED_JULY2_10';
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
  -- THURSDAY July 2 - normal weekday, 13 sales
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-02', 'sale',  65, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-02 08:12:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 240, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-02 08:47:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 130, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-02 09:20:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 510, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-02 10:05:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale',  88, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-02 10:41:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 320, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-02 12:33:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 175, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-02 14:58:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 430, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-02 17:15:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale',  56, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-02 18:02:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 640, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-02 18:39:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 215, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-02 19:24:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 385, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-02 20:10:00+05:30'),
    (v_store, v_user, '2026-07-02', 'sale', 120, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-02 20:52:00+05:30');

  -- ============================================================
  -- FRIDAY July 3 - Balaji restock morning, 14 sales
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-03', 'purchase', 9800, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_JULY2_10', '2026-07-03 09:05:00+05:30');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-03', 'sale',  95, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-03 08:22:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 310, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-03 08:58:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 150, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-03 09:44:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale',  70, 'cash', 'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-03 10:17:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 480, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-03 10:53:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 260, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-03 13:08:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 720, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-03 15:26:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 135, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-03 17:31:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 540, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-03 18:14:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale',  62, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-03 18:50:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 295, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-03 19:33:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 410, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-03 20:07:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale', 180, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-03 20:44:00+05:30'),
    (v_store, v_user, '2026-07-03', 'sale',  85, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-03 21:12:00+05:30');

  -- ============================================================
  -- SATURDAY July 4 - weekend peak: 18 sales + Saini wholesale
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-04', 'sale', 9500, 'credit', c_saini, 'bill_scan', 0, 'DEMO_SEED_JULY2_10', '2026-07-04 11:20:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 1450, 'credit', c_sharma, 'voice',    0, 'DEMO_SEED_JULY2_10', '2026-07-04 18:45:00+05:30');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-04', 'sale', 140, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 08:05:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 385, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-04 08:36:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale',  90, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 09:02:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 610, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-04 09:38:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 225, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 10:11:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 175, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-04 10:49:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 830, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 11:55:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 340, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-04 13:22:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 120, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 15:40:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 465, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-04 17:08:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale',  75, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 17:42:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 920, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-04 18:19:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 255, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 19:03:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 580, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-04 19:47:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 195, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 20:28:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 350, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-04 21:05:00+05:30'),
    (v_store, v_user, '2026-07-04', 'sale', 110, 'cash', 'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-04 21:34:00+05:30');

  -- ============================================================
  -- SUNDAY July 5 - busy market day, 16 sales + evening expense
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-05', 'sale', 165, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 08:18:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 420, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-05 08:55:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale',  95, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 09:27:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 705, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-05 10:04:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 240, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 10:39:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 130, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-05 11:16:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 555, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 12:48:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale',  80, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-05 14:35:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 385, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 16:52:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 270, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-05 17:29:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 640, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 18:06:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 115, 'cash', 'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-05 18:44:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 490, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 19:21:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 205, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-05 19:58:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale', 330, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 20:36:00+05:30'),
    (v_store, v_user, '2026-07-05', 'sale',  60, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-05 21:09:00+05:30');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-05', 'expense', 480, 'cash', 'manual_full', 0, 'DEMO_SEED_JULY2_10', '2026-07-05 21:30:00+05:30');

  -- ============================================================
  -- MONDAY July 6 - slow day, 10 sales
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-06', 'sale',  75, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-06 08:31:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale', 210, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-06 09:14:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale', 145, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-06 10:22:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale', 380, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-06 11:47:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale',  50, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-06 13:55:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale', 295, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-06 16:38:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale', 460, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-06 18:12:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale', 125, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-06 19:05:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale', 340, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-06 19:49:00+05:30'),
    (v_store, v_user, '2026-07-06', 'sale',  90, 'cash', 'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-06 20:31:00+05:30');

  -- ============================================================
  -- TUESDAY July 7 - 11 sales, Meena Devi udhaar
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-07', 'sale', 780, 'credit', c_meena, 'voice', 0, 'DEMO_SEED_JULY2_10', '2026-07-07 17:53:00+05:30');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-07', 'sale', 110, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-07 08:26:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale', 350, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-07 09:08:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale',  85, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-07 09:51:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale', 520, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-07 10:34:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale', 230, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-07 12:19:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale', 165, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-07 14:42:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale', 445, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-07 17:16:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale',  70, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-07 18:37:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale', 615, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-07 19:20:00+05:30'),
    (v_store, v_user, '2026-07-07', 'sale', 190, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-07 20:14:00+05:30');

  -- ============================================================
  -- WEDNESDAY July 8 - Balaji mid-week top-up, 12 sales
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, vendor_name, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-08', 'purchase', 7400, 'cash', 'Balaji Distributors', 'bill_scan', 0, 'DEMO_SEED_JULY2_10', '2026-07-08 14:10:00+05:30');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-08', 'sale', 125, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-08 08:15:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 290, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-08 08:52:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale',  60, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-08 09:36:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 475, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-08 10:23:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 200, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-08 11:41:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 340, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-08 13:29:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 720, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-08 16:47:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale',  95, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-08 17:52:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 410, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-08 18:35:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 155, 'cash', 'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-08 19:18:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale', 265, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-08 20:02:00+05:30'),
    (v_store, v_user, '2026-07-08', 'sale',  80, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-08 20:48:00+05:30');

  -- ============================================================
  -- THURSDAY July 9 - 13 sales, Verma ji clears part of his udhaar
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, customer_id, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-09', 'payment', 1500, 'upi', c_verma, 'manual_full', 0, 'DEMO_SEED_JULY2_10', '2026-07-09 11:32:00+05:30');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-09', 'sale', 105, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-09 08:09:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 330, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-09 08:44:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale',  90, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-09 09:28:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 560, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-09 10:12:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 215, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-09 11:03:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 170, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-09 12:51:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 685, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-09 15:37:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale',  65, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-09 17:24:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 390, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-09 18:08:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 240, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-09 18:53:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 505, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-09 19:41:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale', 135, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-09 20:26:00+05:30'),
    (v_store, v_user, '2026-07-09', 'sale',  75, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-09 21:01:00+05:30');

  -- ============================================================
  -- FRIDAY July 10 (today) - 12 sales through the evening + expense
  -- ============================================================
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-10', 'sale', 140, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-10 08:19:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 365, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-10 08:57:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale',  80, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-10 09:33:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 495, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-10 10:16:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 250, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-10 11:02:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 185, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-10 12:44:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 605, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-10 14:57:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 100, 'upi',  'bill_scan',    0, 'DEMO_SEED_JULY2_10', '2026-07-10 16:49:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 320, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-10 17:38:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 445, 'upi',  'manual_quick', 0, 'DEMO_SEED_JULY2_10', '2026-07-10 18:22:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale', 210, 'upi',  'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-10 19:11:00+05:30'),
    (v_store, v_user, '2026-07-10', 'sale',  95, 'cash', 'voice',        0, 'DEMO_SEED_JULY2_10', '2026-07-10 19:54:00+05:30');
  INSERT INTO transactions (store_id, user_id, date, type, total_amount, payment_method, source, tax_amount, notes, created_at) VALUES
    (v_store, v_user, '2026-07-10', 'expense', 550, 'cash', 'manual_full', 0, 'DEMO_SEED_JULY2_10', '2026-07-10 20:15:00+05:30');

  RAISE NOTICE 'Jul 2-10 sample data complete for store % (tagged DEMO_SEED_JULY2_10).', v_store;
END $$;

-- Verify:
-- SELECT date, count(*), sum(total_amount) FILTER (WHERE type = 'sale') AS sales
-- FROM transactions WHERE notes = 'DEMO_SEED_JULY2_10'
-- GROUP BY date ORDER BY date;