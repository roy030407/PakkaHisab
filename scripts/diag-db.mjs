/**
 * FILE: scripts/diag-db.mjs
 *
 * WHAT THIS DOES:
 *   Schema-metadata-only diagnostic: reads information_schema / pg_catalog
 *   for column defaults, constraints, RLS state, and policies.
 *   Reads NO user/row data.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for debugging scan/insight/share 500s
 *
 * WHERE IT FITS:
 *   Dev tooling only. Not imported by the app. Safe to delete.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually: node scripts/diag-db.mjs
 */
import { readFileSync } from "fs"
import pg from "pg"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/^DIRECT_URL=(.+)$/m)?.[1] ?? env.match(/^DATABASE_URL=(.+)$/m)?.[1]
const client = new pg.Client({ connectionString: url.replace(/^"|"$/g, "") })

async function q(label, sql) {
  const { rows } = await client.query(sql)
  console.log(`=== ${label} ===`)
  console.table(rows)
}

async function main() {
  await client.connect()

  await q("id column defaults", `
    SELECT table_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'id'
    ORDER BY table_name;`)

  await q("periodic_reports columns", `
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'periodic_reports'
    ORDER BY ordinal_position;`)

  await q("periodic_reports constraints", `
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.periodic_reports'::regclass;`)

  await q("RLS state", `
    SELECT tablename, rowsecurity FROM pg_tables
    WHERE schemaname = 'public' ORDER BY tablename;`)

  await q("policies", `
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;`)
}

main()
  .catch((e) => { console.error("DIAG FAILED:", e.message) })
  .finally(() => client.end())
