/**
 * FILE: scripts/apply-004.mjs
 *
 * WHAT THIS DOES:
 *   Applies supabase/migrations/004_id_defaults.sql (additive column
 *   defaults only) and prints the verification query result.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Dev tooling only. Safe to delete after running once.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually: node scripts/apply-004.mjs
 */
import { readFileSync } from "fs"
import pg from "pg"

const env = readFileSync(".env.local", "utf8")
const url = (env.match(/^DIRECT_URL=(.+)$/m)?.[1] ?? env.match(/^DATABASE_URL=(.+)$/m)?.[1]).replace(/^"|"$/g, "")
const client = new pg.Client({ connectionString: url })

const sql = readFileSync("supabase/migrations/004_id_defaults.sql", "utf8")

await client.connect()
await client.query(sql)
console.log("004_id_defaults.sql applied.")

const { rows } = await client.query(`
  SELECT table_name, column_name, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name IN ('id','updated_at')
  ORDER BY table_name, column_name;`)
console.table(rows)
await client.end()
