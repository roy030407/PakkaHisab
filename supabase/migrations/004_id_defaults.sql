-- FILE: supabase/migrations/004_id_defaults.sql
-- WHAT THIS DOES: Adds database-level defaults for id and updated_at columns.
--   Prisma's @default(uuid()) generates IDs in the Prisma client, NOT in the
--   database — but this app inserts via Supabase (PostgREST), which sends no id.
--   Result: every insert that omitted id failed with a NOT NULL violation
--   (scan uploads, quick/full entry, customers, share links, AI conversations).
--   Same problem for updated_at (@updatedAt is also Prisma-client-side).
-- CHANGES: Fix for scan/entry/customers/share 500s (June 2026)
--
-- HOW TO APPLY:
--   Paste this entire file into the Supabase SQL editor and run.
--   Then run the verification query at the bottom.

-- ─── id defaults (all tenant + seed tables) ─────────────────────────────────
ALTER TABLE stores                 ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE products               ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE inventory              ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE stock_movements        ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE customers              ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE fixed_costs            ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE transactions           ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE transaction_items      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE document_uploads       ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE extraction_corrections ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE ai_conversations       ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE periodic_reports       ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE kaggle_products        ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- ─── updated_at defaults (tables where it is NOT NULL with no default) ──────
ALTER TABLE products         ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE inventory        ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE transactions     ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_conversations ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- ─── VERIFICATION ────────────────────────────────────────────────────────────
-- Every id row must show a gen_random_uuid() default:
--
-- SELECT table_name, column_name, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name IN ('id', 'updated_at')
-- ORDER BY table_name, column_name;
