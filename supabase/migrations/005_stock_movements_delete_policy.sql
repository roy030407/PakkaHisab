-- FILE: supabase/migrations/005_stock_movements_delete_policy.sql
-- WHAT THIS DOES: Adds the missing DELETE policy on stock_movements.
--   Without it, deleting a transaction (DELETE /api/transactions/[id]) is
--   blocked by RLS for the stock_movements rows, leaving orphaned stock
--   history that points at a deleted transaction. This closes that gap so a
--   deleted transaction fully reverses its stock movements.
--
-- CHANGES THIS SESSION:
--   - New: stock_movements_store_delete policy (store-scoped)
--
-- HOW TO APPLY:
--   Paste this file into the Supabase SQL editor and run.
--   Safe to re-run (drops the policy first if it exists).

DROP POLICY IF EXISTS "stock_movements_store_delete" ON stock_movements;

CREATE POLICY "stock_movements_store_delete"
  ON stock_movements FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- Verify: should return one row for the DELETE command.
-- SELECT cmd, policyname FROM pg_policies
--   WHERE tablename = 'stock_movements' AND cmd = 'DELETE';
