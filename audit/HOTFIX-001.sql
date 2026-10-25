-- FILE: audit/HOTFIX-001.sql
--
-- WHAT THIS DOES:
--   Closes anonymous write access to two public tables that have no tenant
--   column (audit W0-6, findings-B-live rows 67/68 and the _prisma_migrations
--   finding). Anon writes are a storage-fill / denial-of-service vector on
--   the Supabase free tier.
--     1. kaggle_products: enable row level security with NO policies, so the
--        anon and authenticated roles see and write nothing. The app never
--        reads this table (onboarding uses data/seeds/*.ts).
--     2. _prisma_migrations: same, plus REVOKE ALL from anon and
--        authenticated. Prisma connects as the postgres owner, which bypasses
--        RLS, so prisma migrate keeps working.
--   The table owner (postgres) and service_role bypass RLS and are unaffected.
--
-- SAFE TO RE-RUN: every statement is guarded with IF EXISTS / to_regclass.
-- On a database where a table does not exist (production has no
-- _prisma_migrations), that part is skipped.
--
-- APPLY: Supabase SQL editor, or
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f audit/HOTFIX-001.sql

ALTER TABLE IF EXISTS public.kaggle_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public._prisma_migrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;
  END IF;
END
$$;

-- Verify (read only): both rows should show relrowsecurity = true, and the
-- second query should return no _prisma_migrations rows.
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('kaggle_products', '_prisma_migrations');

SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('kaggle_products', '_prisma_migrations')
  AND grantee IN ('anon', 'authenticated')
GROUP BY 1, 2 ORDER BY 1, 2;
