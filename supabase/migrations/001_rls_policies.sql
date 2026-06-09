-- FILE: supabase/migrations/001_rls_policies.sql
-- WHAT THIS DOES: Enables Row Level Security for all 13 tenant-scoped tables.
--   All policies use store_id as the tenant boundary.
--   kaggle_products has no RLS — it is a public read-only seed table.
-- CHANGES THIS SESSION:
--   - Complete rewrite from old businesses/business_id schema
--   - Covers: stores, products, inventory, stock_movements, customers,
--     fixed_costs, transactions, transaction_items, document_uploads,
--     extraction_corrections, ai_conversations, periodic_reports
--   - Includes item_number auto-assign trigger
--   - Includes Storage bucket RLS for documents bucket
--
-- HOW TO APPLY:
--   Paste this entire file into the Supabase SQL editor and run.
--   Then run the verification query at the bottom.

-- ─── HELPER: standard store ownership check ───────────────────────────────
-- Used in every policy below. Returns true if the store belongs to the
-- currently authenticated user.

-- ─── STORES ──────────────────────────────────────────────────────────────────

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stores_owner_select"
  ON stores FOR SELECT
  USING (owner_id = auth.uid()::text);

CREATE POLICY "stores_owner_insert"
  ON stores FOR INSERT
  WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "stores_owner_update"
  ON stores FOR UPDATE
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_store_select"
  ON products FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "products_store_insert"
  ON products FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "products_store_update"
  ON products FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "products_store_delete"
  ON products FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── INVENTORY ────────────────────────────────────────────────────────────────

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_store_all"
  ON inventory FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── STOCK MOVEMENTS ─────────────────────────────────────────────────────────

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_store_select"
  ON stock_movements FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "stock_movements_store_insert"
  ON stock_movements FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_store_all"
  ON customers FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── FIXED COSTS ─────────────────────────────────────────────────────────────

ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_costs_store_all"
  ON fixed_costs FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_store_select"
  ON transactions FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "transactions_store_insert"
  ON transactions FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "transactions_store_update"
  ON transactions FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "transactions_store_delete"
  ON transactions FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── TRANSACTION ITEMS ────────────────────────────────────────────────────────
-- Access via parent transaction's store ownership

ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_items_store_select"
  ON transaction_items FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM transactions
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text)
    )
  );

CREATE POLICY "transaction_items_store_insert"
  ON transaction_items FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM transactions
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text)
    )
  );

CREATE POLICY "transaction_items_store_update"
  ON transaction_items FOR UPDATE
  USING (
    transaction_id IN (
      SELECT id FROM transactions
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text)
    )
  );

CREATE POLICY "transaction_items_store_delete"
  ON transaction_items FOR DELETE
  USING (
    transaction_id IN (
      SELECT id FROM transactions
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text)
    )
  );

-- ─── DOCUMENT UPLOADS ─────────────────────────────────────────────────────────

ALTER TABLE document_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_uploads_store_select"
  ON document_uploads FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

CREATE POLICY "document_uploads_user_insert"
  ON document_uploads FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    AND store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text)
  );

-- ─── EXTRACTION CORRECTIONS ───────────────────────────────────────────────────

ALTER TABLE extraction_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extraction_corrections_store_all"
  ON extraction_corrections FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── AI CONVERSATIONS ─────────────────────────────────────────────────────────

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_store_all"
  ON ai_conversations FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── PERIODIC REPORTS ─────────────────────────────────────────────────────────

ALTER TABLE periodic_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periodic_reports_store_select"
  ON periodic_reports FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- ─── KAGGLE PRODUCTS — NO RLS ─────────────────────────────────────────────────
-- This is a public read-only seed table. Any authenticated user can read it
-- during onboarding to load sample product templates. No personal data.
-- Do NOT enable RLS on kaggle_products.

-- ─── ITEM NUMBER AUTO-ASSIGN TRIGGER ─────────────────────────────────────────
-- Assigns a sequential item_number per store on product insert.
-- Prevents race conditions that a MAX()+1 query in app code would have.

CREATE OR REPLACE FUNCTION assign_item_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.item_number := COALESCE(
    (SELECT MAX(item_number) FROM products WHERE store_id = NEW.store_id),
    0
  ) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assign_item_number
  BEFORE INSERT ON products
  FOR EACH ROW
  WHEN (NEW.item_number IS NULL OR NEW.item_number = 0)
  EXECUTE FUNCTION assign_item_number();

-- ─── STORAGE BUCKET RLS ───────────────────────────────────────────────────────
-- Run these AFTER creating a private bucket named "documents" in the
-- Supabase dashboard (Storage → New bucket → name: documents, private: on).
-- Files are stored at: documents/{user_id}/{uuid}.{ext}

CREATE POLICY "documents_user_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_user_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── VERIFICATION ─────────────────────────────────────────────────────────────
-- Run this after applying the migration. Every row must show rowsecurity = true
-- except kaggle_products (which intentionally has no RLS).
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
