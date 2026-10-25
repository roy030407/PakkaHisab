# Rebuilding the PakkaHisab database from zero

This is the official guide to building a PakkaHisab Supabase database from an empty project. It was verified on 2026-10-25 against the audit project `wysqzflhsoaiuenlxiia` (Postgres 17.11). Every command below was run exactly as written. Output and errors are copied verbatim.

## Why this guide exists

The schema comes from two migration systems, and neither can rebuild the database on its own (findings-B, B23):

- `prisma/migrations` creates the tables and adds `transactions.voided_at`.
- `supabase/migrations` 001 to 008 add all RLS policies, id defaults, the item-number trigger, `share_token`, `reminder_template`, `cash_reconciliations` and `fixed_cost_overrides`.

Neither system records the order between them. This file does.

## Correct order (verified, zero errors)

| Step | What | Command |
|---|---|---|
| 1 | Prisma init SQL | `npx prisma db execute --file prisma/migrations/20250609000000_init_full_schema/migration.sql` |
| 2 | Record init in Prisma history | `npx prisma migrate resolve --applied 20250609000000_init_full_schema` |
| 3 | `supabase/migrations` 001 to 008, one file at a time, in number order | `psql "$AUDIT_DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/<file>.sql` |
| 4 | Prisma `add_voided_at` | `npx prisma migrate deploy` |
| 5 | Private `documents` bucket | Storage API `POST /storage/v1/bucket` with the service role key |
| 6 | Hotfix: lock `kaggle_products` and `_prisma_migrations` | `psql ... -f audit/HOTFIX-001.sql` |

Every step goes through the safety wrapper `audit/scripts/db-guard.sh` (see Safety).

### The db execute + migrate resolve wrinkle

A plain `npx prisma migrate deploy` applies **both** Prisma migrations in one go: init, then `add_voided_at`. That skips the required position of 001 to 008 in between. So step 1 runs the init SQL directly with `prisma db execute`, and step 2 marks it applied with `prisma migrate resolve`. When `migrate deploy` runs in step 4, Prisma sees init as already applied and applies only `add_voided_at`, and `_prisma_migrations` ends up with the correct history.

Note: nothing in 001 to 008 references `voided_at` (`grep voided supabase/migrations/*.sql` returns nothing). So deploying `add_voided_at` straight after init would also work in practice. The order above is the one the audit specified, and it is proven.

## Safety

- **Never** point these commands at production (`ydvbjofgtqvlipibxgqc`, `PROD_PROJECT_REF` in `.env.audit.local`).
- Use `AUDIT_DATABASE_URL`: the Supavisor pooler in **session mode, port 5432**. The direct host (`AUDIT_DIRECT_URL`) has no IPv4 address, so do not use it.
- Never edit `.env` or `.env.local`. `prisma.config.ts` loads `.env.local` with dotenv and reads `DIRECT_URL`. dotenv never overrides a variable that is already set, so setting `DIRECT_URL` on the command line wins. This was verified:
  ```
  $ DIRECT_URL=PRESET node -e 'require("dotenv").config({path:".env.local",quiet:true});console.log("DIRECT_URL after dotenv:",process.env.DIRECT_URL)'
  DIRECT_URL after dotenv: PRESET
  ```
  Prisma still prints `injected env (12) from .env.local`. That line counts the keys it read, not the keys it overrode.
- **Project ref is in the username, not the hostname.** The pooler host (`aws-0-ap-southeast-1.pooler.supabase.com`) is shared by many Supabase projects. The project ref appears in the tenant username: `postgres.wysqzflhsoaiuenlxiia`. A check that looks for the ref in the hostname always fails. A check that looks only at the hostname would happily pass a production URL on the same pooler. So `db-guard.sh` checks the **full URL**: it must contain `AUDIT_PROJECT_REF` and must not contain `PROD_PROJECT_REF`. Both `AUDIT_DATABASE_URL` and `AUDIT_SUPABASE_URL` are checked. Then it exports `DIRECT_URL` and `DATABASE_URL` and runs the command.
- Every command prints this header first. Stop if it does not appear:
  ```
  [guard] db target: aws-0-ap-southeast-1.pooler.supabase.com:5432 user=postgres.wysqzflhsoaiuenlxiia | api: https://wysqzflhsoaiuenlxiia.supabase.co
  [guard] OK: contains wysqzflhsoaiuenlxiia, not ydvbjofgtqvlipibxgqc
  ```

## Step-by-step log

All commands are run from the repo root in Git Bash. In the session, the guard ran from the scratchpad as `guard.sh`. It is the same script that is now committed as `audit/scripts/db-guard.sh`, so the commands below use that path. The guard header (above) is printed before every command and is not repeated below.

### Step 0: confirm the project is empty

Command:
```
bash audit/scripts/db-guard.sh bash -c 'psql "$AUDIT_DATABASE_URL" -X -A -t -c "select current_database(), version();" -c "select schemaname, count(*) from pg_tables where schemaname in ('"'public'"','"'storage'"','"'auth'"') group by 1;" -c "select id from storage.buckets;"'
```
Output:
```
postgres|PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
storage|8
auth|27
```
No public tables and no buckets.

### Step 1: Prisma init SQL

```
bash audit/scripts/db-guard.sh npx prisma db execute --file prisma/migrations/20250609000000_init_full_schema/migration.sql
```
```
◇ injected env (12) from .env.local // tip: ⌘ custom filepath { path: '/custom/path/.env' }
Loaded Prisma config from prisma.config.ts.

Script executed successfully.
```
Verified that the tables landed in the audit DB:
```
bash audit/scripts/db-guard.sh bash -c 'psql "$AUDIT_DATABASE_URL" -X -A -t -f "$0"' q_tables.sql
# q_tables.sql: select string_agg(tablename, ',' order by tablename) from pg_tables where schemaname='public';
```
```
ai_conversations,customers,document_uploads,extraction_corrections,fixed_costs,inventory,kaggle_products,periodic_reports,products,stock_movements,stores,transaction_items,transactions
```
The only error in the whole build came from my first attempt at this check. It was a shell quoting mistake, not a migration problem:
```
ERROR:  column "," does not exist
LINE 1: select string_agg(tablename, "," order by tablename) from pg...
```
Fixed by putting the query in a file, as above.

### Step 2: mark init as applied

```
bash audit/scripts/db-guard.sh npx prisma migrate resolve --applied 20250609000000_init_full_schema
```
```
◇ injected env (12) from .env.local // tip: ⌘ enable debugging { debug: true }
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-ap-southeast-1.pooler.supabase.com:5432"

Migration 20250609000000_init_full_schema marked as applied.
```
(Prisma also printed an "Update available 7.8.0 -> 8.0.0-rc.27" banner. Ignore it.)

### Step 3: supabase/migrations 001 to 008

```
for f in 001_rls_policies 002_share_tokens 003_fix_share_rls 004_id_defaults 005_stock_movements_delete_policy 006_reminder_template 007_cash_reconciliations 008_fixed_cost_overrides; do
  bash audit/scripts/db-guard.sh bash -c 'psql "$AUDIT_DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$0"' "supabase/migrations/$f.sql" || break
done
```
Every file exited 0. Output, summarised as count and line:

| File | Output |
|---|---|
| 001_rls_policies | 12 ALTER TABLE, 1 CREATE FUNCTION, 27 CREATE POLICY, 1 CREATE TRIGGER |
| 002_share_tokens | 4 ALTER TABLE, 1 CREATE INDEX, 2 CREATE POLICY, 2 DROP POLICY, plus 3 notices (below) |
| 003_fix_share_rls | 1 DROP POLICY |
| 004_id_defaults | 17 ALTER TABLE |
| 005_stock_movements_delete_policy | 1 CREATE POLICY, 1 DROP POLICY, plus 1 notice |
| 006_reminder_template | 1 ALTER TABLE |
| 007_cash_reconciliations | 1 ALTER TABLE, 1 CREATE POLICY, 1 CREATE TABLE, 1 DROP POLICY, plus 1 notice |
| 008_fixed_cost_overrides | 1 ALTER TABLE, 1 CREATE POLICY, 1 CREATE TABLE |

The notices are verbatim below. They are harmless: each comes from an idempotent `DROP ... IF EXISTS` on a fresh DB.
```
psql:supabase/migrations/002_share_tokens.sql:17: NOTICE:  constraint "periodic_reports_store_period_uniq" of relation "periodic_reports" does not exist, skipping
psql:supabase/migrations/002_share_tokens.sql:27: NOTICE:  policy "periodic_reports_owner_all" for relation "periodic_reports" does not exist, skipping
psql:supabase/migrations/002_share_tokens.sql:28: NOTICE:  policy "periodic_reports_public_share_read" for relation "periodic_reports" does not exist, skipping
psql:supabase/migrations/005_stock_movements_delete_policy.sql:15: NOTICE:  policy "stock_movements_store_delete" for relation "stock_movements" does not exist, skipping
psql:supabase/migrations/007_cash_reconciliations.sql:35: NOTICE:  policy "cash_reconciliations_owner_all" for relation "cash_reconciliations" does not exist, skipping
```

001 creates the `storage.objects` policies for bucket `documents` before the bucket exists. That is fine: the policies match on `bucket_id = 'documents'` and apply once the bucket is created in step 5.

### Step 4: Prisma add_voided_at

```
bash audit/scripts/db-guard.sh npx prisma migrate deploy
```
```
◇ injected env (12) from .env.local // tip: ◈ secrets for agents [www.dotenvx.com]
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-ap-southeast-1.pooler.supabase.com:5432"

2 migrations found in prisma/migrations

Applying migration `20260620_add_voided_at_to_transactions`

The following migration(s) have been applied:

migrations/

All migrations have been successfully applied.
```
```
bash audit/scripts/db-guard.sh npx prisma migrate status
```
```
2 migrations found in prisma/migrations

Database schema is up to date!
```

### Step 5: private documents bucket

```
bash audit/scripts/db-guard.sh bash -c 'curl -sS -w "\nHTTP %{http_code}\n" -X POST "$AUDIT_SUPABASE_URL/storage/v1/bucket" -H "apikey: $AUDIT_SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $AUDIT_SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d "{\"id\":\"documents\",\"name\":\"documents\",\"public\":false}"'
```
```
{"name":"documents"}
HTTP 200
```
Read back:
```
{"id":"documents","name":"documents","owner":"","public":false,"file_size_limit":null,"allowed_mime_types":null,"created_at":"2026-10-25T10:40:34.128Z","updated_at":"2026-10-25T10:40:34.128Z"}
HTTP 200
```

### Step 6: HOTFIX-001

```
bash audit/scripts/db-guard.sh bash -c 'psql "$AUDIT_DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f audit/HOTFIX-001.sql'
```
Run twice. Both runs gave identical output and exit 0, which proves it is safe to re-run:
```
ALTER TABLE
ALTER TABLE
DO
      relname       | relrowsecurity
--------------------+----------------
 _prisma_migrations | t
 kaggle_products    | t
(2 rows)

   table_name    |    grantee    |                       privileges
-----------------+---------------+---------------------------------------------------------
 kaggle_products | anon          | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
 kaggle_products | authenticated | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
(2 rows)
```
The `kaggle_products` grants remain on purpose. With RLS on and no policies, those grants match zero rows. `prisma migrate status` still reports `Database schema is up to date!` after the hotfix: Prisma connects as the table owner, which bypasses RLS.

## Live RLS inventory after the build, compared with findings-B section 2

Query: `pg_class.relrowsecurity` for every table in `public`, plus `pg_policies` for `public` and `storage`. Taken before HOTFIX-001.

| Table | RLS | Live policy commands | Matches findings-B section 2? |
|---|---|---|---|
| `_prisma_migrations` | **OFF** | none | **Not in findings-B.** Created by Prisma in `public`, so PostgREST exposes it. anon and authenticated had full DML grants. Fixed by HOTFIX-001 |
| ai_conversations | on | ALL | yes |
| cash_reconciliations | on | ALL | yes |
| customers | on | ALL | yes |
| document_uploads | on | INSERT, SELECT | yes (no UPDATE / DELETE, B16) |
| extraction_corrections | on | ALL | yes |
| fixed_cost_overrides | on | ALL (USING only, no WITH CHECK) | yes |
| fixed_costs | on | ALL | yes |
| inventory | on | ALL | yes |
| kaggle_products | **OFF** | none | yes (B28). anon and authenticated have full DML grants. Fixed by HOTFIX-001 |
| periodic_reports | on | ALL (owner, 002) + SELECT (store, 001) | yes. The 002 public share policy is gone (dropped in 003), verified live |
| products | on | SELECT, INSERT, UPDATE, DELETE | yes |
| stock_movements | on | SELECT, INSERT, DELETE | yes (no UPDATE) |
| stores | on | SELECT, INSERT, UPDATE | yes (no DELETE) |
| transaction_items | on | SELECT, INSERT, UPDATE (no WITH CHECK), DELETE | yes |
| transactions | on | SELECT, INSERT, UPDATE, DELETE | yes |
| storage.objects (`documents`) | n/a | SELECT `documents_user_read`, INSERT `documents_user_upload` | yes (no UPDATE / DELETE, B16) |

The only difference from the migration files is `_prisma_migrations`. It is not a migration-file drift. It is a side effect of building with Prisma into `public`.

**Production is different.** A read-only check of production on 2026-10-25 found `kaggle_products` already has RLS **on** (with no policies), no `_prisma_migrations` table in any schema, and no public table with RLS off. Production was built by pasting SQL, not by `prisma migrate`, and RLS on `kaggle_products` was enabled by hand at some point. See findings-B-live.md.
