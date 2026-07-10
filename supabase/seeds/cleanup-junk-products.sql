-- ============================================================================
-- CLEANUP: deactivate junk products created by old voice auto-create
-- ----------------------------------------------------------------------------
-- Before commit b7f471e, every misheard voice phrase was auto-inserted as a
-- real active product at price 0 in category 'Uncategorised' (e.g.
-- "Aloo bujiao", "Ranu - cuvette", "panimitte", duplicate "chupa chups").
-- Those rows pollute the Most Popular strip and product search.
--
-- This soft-deactivates them (is_active = false). Nothing is deleted:
-- transactions that referenced them keep their history via product_name_raw.
--
-- RUN: paste into Supabase SQL editor, run ONCE. Safe to re-run.
-- ============================================================================

UPDATE products
SET is_active = false
WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
  AND selling_price = 0
  AND category = 'Uncategorised'
  AND is_active = true;

-- Verify (should list the 12 deactivated junk rows):
-- SELECT name, selling_price, category, is_active, created_at
-- FROM products
-- WHERE store_id IN (SELECT id FROM stores WHERE name ILIKE '%ram kirana%')
--   AND category = 'Uncategorised' AND selling_price = 0
-- ORDER BY created_at DESC;