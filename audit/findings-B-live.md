# Session B live results: RLS proof, balance race, production check

Date: 2026-10-25. Target: audit project `wysqzflhsoaiuenlxiia`, built from zero per `audit/BUILD-DB.md` (Prisma init, 001 to 008, `add_voided_at`, private `documents` bucket). Every command went through `audit/scripts/db-guard.sh`, which refuses any URL that contains the production ref or lacks the audit ref. Production was touched only by read-only SELECTs (section 4).

## Verdict

- **No cross-tenant leak. RLS P0 is closed.** All 71 cross-tenant and anon probes were BLOCKED: 56 SELECT, UPDATE and DELETE probes across 14 tables as user 2 and anon, 8 cross-INSERTs, 1 share-token enumeration, and 6 storage attacks.
- The script printed 4 LEAK rows. **None is a tenant data leak.** Their reclassification is in section 2.
- New finding: `_prisma_migrations` was anon-writable in the rebuilt DB. Fixed together with `kaggle_products` by `audit/HOTFIX-001.sql`, verified on the audit DB (section 5).
- **Lost updates confirmed on real Postgres.** 20 concurrent Rs10 credit sales left a balance of Rs10 to 20 instead of Rs200. 20 concurrent -1 stock moves left 998 to 999 instead of 980 (section 3).

## 1. B-rls-proof.ts results (before hotfix)

Command (credentials mapped inline from `.env.audit.local`):
```
bash audit/scripts/db-guard.sh bash -c 'AUDIT_B_SUPABASE_URL="$AUDIT_SUPABASE_URL" AUDIT_B_ANON_KEY="$AUDIT_SUPABASE_ANON_KEY" AUDIT_B_SERVICE_ROLE_KEY="$AUDIT_SUPABASE_SERVICE_ROLE_KEY" npx tsx audit/scripts/B-rls-proof.ts'
```
Raw results: `audit/scripts/B-rls-results-pre-hotfix.json` (78 rows). The run after the hotfix is in `audit/scripts/B-rls-results.json`.

| Probe group | Tables | Outcome |
|---|---|---|
| user 2 SELECT by id | products, customers, fixed_costs, transactions, inventory, transaction_items, stock_movements, document_uploads, extraction_corrections, ai_conversations, periodic_reports, cash_reconciliations, fixed_cost_overrides, stores | 14/14 BLOCKED (rows=0) |
| anon SELECT by id | same 14 | 14/14 BLOCKED |
| user 2 UPDATE (checked via service role) | same 14 | 14/14 BLOCKED (value unchanged) |
| user 2 DELETE (checked via service role) | same 14 | 14/14 BLOCKED (row still exists) |
| user 2 INSERT into user 1's store | products, customers, transactions, transaction_items, stock_movements, fixed_cost_overrides, cash_reconciliations, stores | 8/8 BLOCKED (`new row violates row-level security policy`) |
| anon enumerate `share_token` rows | periodic_reports | BLOCKED (rows=0) |
| storage `documents`: user 2 download, list, overwrite, plant in user 1's folder, delete; anon download | storage.objects | 6/6 BLOCKED |
| Cross-tenant FK from user 2's own store | transactions.customer_id, inventory.product_id | 2 LEAK rows (rows 64, 65; see section 2) |
| user 2 / anon INSERT | kaggle_products | 2 LEAK rows (rows 67, 68; see section 2) |

NOTE rows (behaviour, not attacks):
- Row 66: user 1 UPDATE on their **own** `document_uploads` row: `rowsUpdated=0`. Confirms B16 live: scan status and `raw_extraction_json` are never saved.
- Row 75: user 1 deletes their **own** storage file: `still exists=true`. Confirms B16 live: failed-scan cleanup leaves orphans.
- Row 77: bucket inventory `[{"name":"documents","public":false}]`.

## 2. The 4 LEAK rows and their reclassification

| Row | Probe | What actually happened | Reclassified as |
|---|---|---|---|
| 64 | user 2 own tx referencing user 1 `customer_id` | User 2 inserted a transaction **in their own store** that references user 1's customer id. The FK accepted it. Nothing of user 1's was read or changed; RLS still hides the joined customer row from user 2. | **B27, confirmed live. Stays in W0-5.** Fix with ownership checks in `entry/quick` and `entry/full`, plus composite foreign keys (`(store_id, customer_id)` → `customers(store_id, id)`, the same for `product_id`). |
| 65 | user 2 own inventory row for user 1 `product_id` | Same pattern for `inventory.product_id`. | **B27, confirmed live. Stays in W0-5.** |
| 67 | user 2 INSERT into `kaggle_products` | Any logged-in user can write the global seed table (RLS off, full grants). No tenant data; the app never reads it. | **B28, confirmed live. Wave 0, folded into W0-6, production hotfix** (anon writes are a storage-fill / denial-of-service vector on the free tier). Fixed by HOTFIX-001. |
| 68 | anon INSERT into `kaggle_products` | Same, with no session at all. | Same as row 67. |

## 3. B-balance-race-live.ts results

Command:
```
bash audit/scripts/db-guard.sh bash -c 'AUDIT_B_SUPABASE_URL="$AUDIT_SUPABASE_URL" AUDIT_B_ANON_KEY="$AUDIT_SUPABASE_ANON_KEY" AUDIT_B_SERVICE_ROLE_KEY="$AUDIT_SUPABASE_SERVICE_ROLE_KEY" npx tsx audit/scripts/B-balance-race-live.ts'
```
The run is real Postgres behind PostgREST with RLS applied, as user `audit-b-race` (anon key + JWT). Balance uses the exact select-then-update sequence of `entry/quick`, `entry/full`, `scan/confirm` and `customers/[id]/payment`. Stock calls the real `lib/inventory/updateStock.ts`. Each run uses N = 20 concurrent operations.

| Run | Balance observed | Balance expected | Stock observed | Stock expected |
|---|---|---|---|---|
| 1 | 20 | 200 | 998 | 980 |
| 2 | 20 | 200 | 999 | 980 |
| 3 | 10 | 200 | 998 | 980 |

- 18 to 19 of 20 balance updates were lost (90 to 95%).
- 18 to 19 of 20 stock decrements were lost.
- This matches the in-memory results in findings-B section 3 (Rs10 to 40 and 98 to 99). B1 and B2 are confirmed on real Postgres. **W0-1 stands as is.**

## 4. New finding: `_prisma_migrations` writable by anon

- `prisma migrate` creates `_prisma_migrations` in `public`, with RLS off. Supabase's default grants give `anon` and `authenticated` `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on it.
- Live, before the hotfix:
  - `GET /rest/v1/_prisma_migrations?select=migration_name` with only the anon key returned both migration names (HTTP 200).
  - A `PATCH` matching no row returned `[]` with HTTP 200, not a permission error. So anon could rewrite or delete migration history and insert junk rows.
- No tenant data is involved, but this is the same storage-fill / tampering vector as `kaggle_products`. **Wave 0, folded into W0-6, production hotfix.**

### Production, read only

Production `DATABASE_URL` from `.env.local` (`aws-1-ap-northeast-2.pooler.supabase.com:6543`, user `postgres.ydvbjofgtqvlipibxgqc`). The `?pgbouncer=true` query string was stripped, because psql rejects it. The session was started with `PGOPTIONS="-c default_transaction_read_only=on"`, and every query ran inside `BEGIN READ ONLY ... ROLLBACK` (`transaction_read_only` reported `on`). Only SELECTs on `pg_class`, `pg_namespace`, `pg_policies` and `information_schema.role_table_grants` were run. No writes of any kind.

| Check | Production result |
|---|---|
| `kaggle_products` relrowsecurity | **true** (RLS already on) |
| `kaggle_products` policies | none, so anon and authenticated are blocked despite the grants |
| `kaggle_products` grants to anon / authenticated | `DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE` (both) |
| `_prisma_migrations` | **does not exist** in any schema (prod was built by pasting SQL, not `prisma migrate`) |
| Other public tables with RLS off | **none** (15 public tables, all RLS on) |

Production is therefore **not exposed today** on either table. The production project is also reachable again: the NXDOMAIN in C3 / D B-1 no longer reproduces. HOTFIX-001 is still worth applying there. On production it is a no-op today (RLS is already on, and the `_prisma_migrations` part is skipped), and it protects any future rebuild that uses `prisma migrate`. It is also now part of the rebuild order in BUILD-DB.md.

## 5. HOTFIX-001 verification on the audit DB

`audit/HOTFIX-001.sql` enables RLS (no policies) on `kaggle_products` and `_prisma_migrations`, and revokes all on `_prisma_migrations` from anon and authenticated. Every statement is guarded with `IF EXISTS` / `to_regclass`.

- Applied twice with `psql -v ON_ERROR_STOP=1 --single-transaction`. Both runs exited 0 with identical output, so it is safe to re-run.
- B-rls-proof.ts rerun after the hotfix (`audit/scripts/B-rls-results.json`):
  - Row 67 (user 2 INSERT `kaggle_products`): **BLOCKED**, `new row violates row-level security policy for table "kaggle_products"`.
  - Row 68 (anon INSERT `kaggle_products`): **BLOCKED**, same message.
  - Rows 64 and 65 are still LEAK, as expected. B27 is a W0-5 code + schema fix and not part of the hotfix.
  - The other 74 rows are unchanged (71 BLOCKED, 3 NOTE). Totals went from 71 BLOCKED / 4 LEAK / 3 NOTE to 73 BLOCKED / 2 LEAK / 3 NOTE.
- `_prisma_migrations` as anon after the hotfix:
  - `GET`: HTTP 401 `{"code":"42501",...,"message":"permission denied for table _prisma_migrations"}`
  - `PATCH` (no-op filter): HTTP 401 `42501 permission denied`
  - `POST` (insert): HTTP 401 `42501 permission denied`
- `npx prisma migrate status` on the audit DB after the hotfix: `2 migrations found in prisma/migrations` / `Database schema is up to date!`. Prisma connects as the owner, which bypasses RLS.

HOTFIX-001 was **not** applied to production. The owner will paste it into the Supabase SQL editor.

## Cleanup

The proof scripts create throwaway `audit-b-*@example.com` users. After each run they delete the users, the stores (children cascade), the storage objects and the injected `kaggle_products` rows.
