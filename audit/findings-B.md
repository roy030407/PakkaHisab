# Session B findings: data integrity, RLS, money correctness

Audit date: 2026-10-15. Scope: brief items 1 to 7. Mode: **static plus in-memory tests only**.

## Read this first: what was and was not run

- `audit/PLAN.md`, `INVENTORY.md` and `BASELINE.md` do not exist in this repo, and there is no Session B worktree (`git worktree list` shows only `main`).
- `.env.local` points at Supabase project `ydvbjofg...`, which is the main project, not a dedicated audit project. With the owner's agreement, **nothing was written to any database.** No users were created, no seeds were run, and no RLS attack was executed.
- Instead:
  - Every claim below comes from reading code, or from a test that drives the **real route handlers** (`app/api/...`) with the Supabase client swapped for an in-memory fake (`audit/tests/B-fakeSupabase.ts`). The fake yields to the event loop on every query, just as a network round-trip does, so concurrent requests interleave the way they do in production.
  - The live proofs are written and ready, and each refuses to run against the main project:
    - `audit/scripts/B-rls-proof.ts`: two users, every table and the storage bucket, select/update/delete/cross-insert.
    - `audit/scripts/B-balance-race-live.ts`
- **No P0 is claimed.** P0 status for RLS can only come from running `B-rls-proof.ts` against a dedicated project with migrations 001 to 008 applied. Static reading of the policies found no cross-tenant path (section 2).

How to run:

```
npx vitest run --config audit/tests/B-vitest.config.ts          # 39 tests: 30 fail (= findings), 9 pass
npx tsx audit/scripts/B-schema-diff.ts                           # static schema vs code
AUDIT_B_SUPABASE_URL=... AUDIT_B_ANON_KEY=... AUDIT_B_SERVICE_ROLE_KEY=... npx tsx audit/scripts/B-rls-proof.ts
AUDIT_B_SUPABASE_URL=... AUDIT_B_ANON_KEY=... AUDIT_B_SERVICE_ROLE_KEY=... npx tsx audit/scripts/B-balance-race-live.ts
```

The app's own suite (`npx vitest run`) still passes: 110/110. No app code or migrations were modified.

Severity scale:
- **P0:** cross-tenant leak, or silent loss of a real user's data.
- **P1:** wrong money or stock in normal use.
- **P2:** wrong in edge cases or in a secondary feature.
- **P3:** minor or cosmetic.

---

## Summary (severity sorted)

| # | Sev | Finding | Where | Evidence |
|---|-----|---------|-------|----------|
| B1 | P1 | Lost updates on `customers.current_balance`. Every writer does read-then-write in JS: credit sale (quick, full, scan) and receive-payment. Two overlapping saves lose one. | `app/api/entry/quick/route.ts:164-177`, `app/api/entry/full/route.ts:135-148`, `app/api/scan/confirm/route.ts:233-246`, `app/api/customers/[id]/payment/route.ts:62-92` | B-balance-race: 2 overlapping Rs10 sales give Rs10 (expected 20); 20 concurrent give Rs10-40 (expected 200); 20 payments give 990 (expected 800). Sequential control passes. |
| B2 | P1 | Lost updates on `inventory.current_stock` in `updateStock`. Read-then-write, plus a first-insert race that drops stock, plus a clamp that drops the first sale. | `lib/inventory/updateStock.ts:53-69`, `:75-81` (`Math.max(0, delta)`) | 20 concurrent -1 give 98-99 (expected 80). 5 concurrent first +10 give 10-20 (expected 50); the losers log "duplicate key". 2 first sales of 5 give -5 (movements say -10). |
| B3 | P1 | Cash/UPI toggle shown after a **credit** sale flips `payment_method` but never removes the amount from udhaar. A later delete then leaves it permanently stuck. | `components/shared/PaymentToggle.tsx:43-53` to `app/api/transactions/[id]/route.ts:182-196`; shown by `QuickEntry.tsx:168` and `voice/page.tsx:259` | B-integrity: credit sale then "Cash" gives balance 100 (expected 0). Then delete gives 100 (expected 0). |
| B4 | P1 | Void then Delete reverses stock and balance **twice**. The customer ledger shows a Delete button on voided rows, and DELETE does not check `voided_at`. | `app/api/transactions/[id]/route.ts:27-125`, `components/customers/CustomerLedger.tsx:167` | Rs100 credit sale, void, delete gives balance -100, stock 110 (expected 0 / 100). |
| B5 | P1 | GST is always Rs0. Every write path hard-codes `tax_amount: 0`; the tax summary only sums `tax_amount`. Item `tax_rate` is stored but never used. `tax_type` is never written and `is_interstate` is never read. | `entry/quick/route.ts:70,130`, `entry/full/route.ts:100`, `scan/confirm/route.ts:119`, `lib/reports/tax.ts` | Rs118 sale of an 18% product gives `taxSummary {collected:0, paid:0, payable:0}`. |
| B6 | P1 | Unpaged queries are silently capped at PostgREST max-rows (Supabase default 1000). This affects monthly/yearly reports, dashboard all-time totals, the activity banner, inventory movements and the AI advisor context. | `lib/reports/buildReport.ts:48-55`, `app/(dashboard)/dashboard/page.tsx:87-92`, `app/api/activity/route.ts:44-50` | 1200 sales x Rs10 in October report Rs10,000 (expected 12,000). **Verify the live max-rows setting** (Dashboard > API settings). |
| B7 | P1 | Scan confirm drops line items when a bill has 2+ "add as new" products. The lines are created in parallel; the `assign_item_number` trigger (MAX+1) gives them the same number, so the unique index rejects all but one and those lines vanish. The header total is kept, so items, stock and total disagree. | `app/api/scan/confirm/route.ts:147-173`, trigger in `001_rls_policies.sql:210-225` | 3 new items give 1 `transaction_items` row; `total_amount` stays 300. Modelled on Postgres READ COMMITTED; confirm live. |
| B8 | P1 | Weekly and monthly cron reports cover the wrong period and probably never save. On Monday 06:00 IST, `getPeriodBounds('weekly')` returns the week **starting today** (empty). `period_start` is written as `"10-12"` (the chart label `MM-DD`) into a DATE column, and the upsert error is not checked. | `app/api/cron/weekly-report/route.ts:46-58`, `monthly-report/route.ts:50`, `lib/reports/periods.ts:154` | Cron run gives `period_start=10-12`, `sales=0` (expected the previous week, 700). |
| B9 | P1 | SQL seeds pick their target with `name ILIKE '%ram kirana%' ORDER BY created_at DESC`. A real merchant who names their shop "Ram Kirana ..." becomes the target: demo rows are inserted into their store, `cleanup-junk-products.sql` deactivates their Rs0 products, and balances are recomputed. The SQL editor bypasses RLS. | all of `supabase/seeds/*.sql` (e.g. `RESET-AND-RESEED.sql:35-39`, `cleanup-junk-products.sql:15-20`) | Static. Use a fixed store id in each script. |
| B10 | P2 | Time zone mismatch. Writes take the **UTC** date (`toISOString()`) while dashboard and transactions read the **IST** date, so anything entered 00:00-05:30 IST is dated yesterday and disappears from "Today". Reports use server-local bounds; on a dev machine in IST the October report includes 30 Sep. | `entry/quick/route.ts:65,124`, `entry/full/route.ts:50` (comment says IST), `scan/confirm/route.ts:111`, `payment/route.ts:49`, `reconciliation/route.ts`, `lib/reports/periods.ts`; 35 call sites | Sale at 01:30 IST on 15 Oct is stored as 2026-10-14. `TZ=Asia/Kolkata` monthly includes Rs999 from 30 Sep. |
| B11 | P2 | Cash sales recorded as UPI by default: voice (no customer) hard-codes `upi`, dashboard tap-to-sell hard-codes `upi` with no toggle, and QuickEntry and scan default to `upi`. The expected drawer cash in Din ka hisab is understated. | `voice/page.tsx:104`, `DashboardFrequentItems.tsx:37`, `QuickEntry.tsx:48`, `ExtractionReview.tsx:101` | Static. |
| B12 | P2 | Scanned purchase bills are always saved as `payment_method: 'cash'`, so a supplier bill on credit is deducted from expected drawer cash. | `scan/confirm/route.ts:103` | Purchase sent with `credit` is stored as `cash`. |
| B13 | P2 | Opening cash carries from the **last closed** day, so days that were never closed vanish from the drawer chain. | `app/api/reconciliation/route.ts:45-57` | Closed 12 Oct at 1000, 13 Oct had Rs500 cash sales and no close: 14 Oct opens at 1000 (expected 1500). Month boundary works. |
| B14 | P2 | Fixed costs don't add up to the entered amount for a month: monthly = amount/30 x days in month, so Rs15,000 rent is Rs15,500 in Oct and Rs14,000 in Feb. A Rs18,000 override reports Rs18,600. The override is applied using the cost's frequency (a yearly cost overridden for one month is wrong), weekly reports use the start month only, and the dashboard ignores overrides. | `lib/reports/periods.ts:63-76`, `buildReport.ts:46,100-108`, `dashboard/page.tsx:122-129` | Oct monthly gives 15500 / 18600 (expected 15000 / 18000). Spec 4e says daily = monthly/30, so the spec is ambiguous; decide what a month should cost. |
| B15 | P2 | Floating-point paise in cash reconciliation: UI shows "Tally" only on `diff === 0`. Three Rs33.30 cash sales counted as Rs99.90 show not tallied. | `lib/reports/cashReconciliation.ts`, `app/(dashboard)/reconcile/page.tsx:112-113` | expected=99.89999999999999, diff=1.4e-14. |
| B16 | P2 | `document_uploads` has no UPDATE policy and `storage.objects` has no DELETE policy for `documents`. Every status / `raw_extraction_json` update in scan and scan-confirm affects 0 rows, and failed-scan cleanup removes nothing. | `001_rls_policies.sql:162-174,232-245`; callers `scan/route.ts:122,142,145,170`, `scan/confirm/route.ts:250-254` | Static; `B-rls-proof.ts` records it as NOTE. Verify live (policies may have been added by hand). |
| B17 | P2 | Writes are not atomic and errors are ignored: item inserts, `updateStock` failures and balance updates can fail after the transaction row exists (a tx with no items, or stock not moved). | `entry/quick/route.ts:137-161`, `updateStock.ts:47-50,68-70` | Static. |
| B18 | P2 | Missing input validation: negative/NaN quantity accepted (a "sale" then adds stock and reduces udhaar); credit sale with no customer accepted; full-entry `type` not validated (can write `payment` with items); scan `total_amount` taken from the client, not the sum of lines. | `entry/quick/route.ts:100-117`, `entry/full/route.ts:70-80,94`, `scan/confirm/route.ts:113` | qty -5 credit sale gives 201, balance -50, stock 105. No-customer credit sale gives 201. |
| B19 | P2 | Manual stock adjustment writes a Rs0 `purchase`/`expense` transaction with `source='manual_quick'`. It counts as quick-entry usage and as a purchase row, and deleting it does not undo the adjustment (no line items). | `app/api/inventory/route.ts:139-152` | Adjust +25 then delete that tx: stock stays 125. |
| B20 | P2 | Import writes `source='csv_import'` for Excel too (`excel_import` is never written); `type` and `payment_method` are free text, so a column value of "Sale" or "UPI" is invisible to every report (compares `'sale'`); imported credit sales never touch balances; customer opening balances cannot be imported. | `app/api/import/confirm/route.ts:132,165-170` | Static. |
| B21 | P2 | Sample-vs-real separation is inconsistent. Excluded only from the activity banner and the dashboard all-time numbers; **included** in today/MTD dashboard, reports, GST, cash close, AI advisor and receivables (seed customers carry `DEMO_SEED`). The activity route uses case-sensitive `startsWith`; the dashboard uses `ilike`. | `app/api/activity/route.ts:55`, `dashboard/page.tsx:92,98` | Static. |
| B22 | P2 | Rows inserted by SQL without the `DEMO_SEED` tag count as real usage. The untracked `ram-kirana-jul9-real-sales.sql` inserts two sales "NOT tagged DEMO_SEED - these count as real usage" with `source='voice'` set by hand. `patch-sources.sql` / `patch-all-sources.sql` rewrite demo `source` values to a target channel mix. | `supabase/seeds/ram-kirana-jul9-real-sales.sql:1-25`, `patch-sources.sql:26-41` | Static. The activity banner cannot tell app-entered from SQL-entered rows. |
| B23 | P2 | Two migration systems, and neither rebuilds the DB alone. `voided_at` exists only in Prisma migrations; `share_token`, `reminder_template`, `cash_reconciliations`, `fixed_cost_overrides`, id defaults and all RLS exist only in `supabase/migrations`. There are no CHECK constraints on `type`, `source` or `payment_method`. | `prisma/migrations/*`, `supabase/migrations/*` | `B-schema-diff.ts` (columns consistent). |
| B24 | P3 | Profit card arithmetic: each figure is rounded separately, so sales - purchases - fixed - expenses differs from the displayed net by Rs1 to 2. | `lib/reports/profit.ts:22-30` | 1997 / 5000 random paise inputs disagree. |
| B25 | P3 | Receive-payment rows are labelled `source='manual_quick'`, so udhaar collections inflate "quick entry" usage. | `payment/route.ts:80` | Static. |
| B26 | P3 | Other edit gaps: `set_payment` is allowed on voided tx (no state check); there is no endpoint to edit a sale's items/qty (only payment method), so the only "edit" is delete and re-enter. `transactions.updated_at` is never bumped (no trigger, routes don't set it). | `transactions/[id]/route.ts:182-196` | set_payment on voided gives 200. |
| B27 | P3 | Cross-tenant foreign key accepted: quick/full attach any `customerId` without checking store (scan does check). This is not a read leak (RLS filters the join, and balance updates are store-scoped), but it lets the ledger point at another tenant's id. Same for `transaction_items.product_id` / `inventory.product_id` (RLS checks only `store_id`). | `entry/quick/route.ts:127`, `entry/full/route.ts:96` | Foreign customer id is stored on the tx. |
| B28 | P3 | `kaggle_products` has RLS disabled and is never queried by the app. With Supabase default grants, anon can probably INSERT/UPDATE/DELETE it (free write surface). | `001_rls_policies.sql:196-199` | `B-rls-proof.ts` probes it. |
| B29 | P3 | Sample-store seed route is not idempotent under a double tap (count check, then insert): two calls give a duplicate catalog. | `app/api/stores/seed/route.ts` | Static. |

Tests that pass (behaviour confirmed correct):
- Deleting an unvoided credit sale fully reverts stock, balance, items and movements.
- The fixture day's daily report matches the hand calculation.
- The cash position for the fixture day is exact (1100.50 / UPI 199.99).
- The month-boundary opening cash carries over.
- A Rs0.10 + Rs0.20 drawer tallies.
- Two concurrent voids reversed once in the fake (the race window exists but did not trigger at this seed).

---

## 1. Schema truth

**Columns.** `audit/scripts/B-schema-diff.ts` collects every column named in `.select()`, filters and insert/update object literals for each `.from('table')` in `app/`, `lib/` and `components/`. It compares them to `prisma/schema.prisma` plus `supabase/migrations`.
- Result: **no column used in code is missing from the schema.**
- Schema columns never referenced:

| Table | Unused columns |
|---|---|
| `transactions` | `tax_type`, `updated_at` |
| `ai_conversations` | `created_at`, `updated_at` |
| `periodic_reports`, `document_uploads`, `cash_reconciliations`, `fixed_cost_overrides` | `created_at` |
| `kaggle_products` | the whole table (onboarding reads `data/seeds/*.ts`) |

- Spec tables that are absent everywhere: `kaggle_examples` / `bill_examples`, needed for the extraction few-shots described in CLAUDE.md.

**Drift that matters is in migrations and policies, not columns.** See B23 and B16. A fresh environment needs, in order:
1. Prisma init
2. `supabase/migrations` 001 to 008
3. Prisma `add_voided_at`

Nothing records that order.

**`transactions.source` by channel**

| Channel | Route | `source` written | Correct? |
|---|---|---|---|
| Quick entry | `entry/quick` | `manual_quick` | yes |
| Dashboard tap-to-sell | `entry/quick` | `manual_quick` | yes (same surface family) |
| Voice | `entry/quick` with `source:'voice'` (whitelisted) | `voice` | yes |
| Full entry | `entry/full` | `manual_full` | yes |
| Bill scan | `scan/confirm` | `bill_scan` (hard-coded, not spoofable) | yes |
| Ledger-page scan | `/ledger` only reads, never saves | n/a | n/a |
| CSV import | `import/confirm` | `csv_import` | yes |
| Excel import | `import/confirm` | `csv_import` | **no** (B20) |
| Receive payment | `customers/[id]/payment` | `manual_quick` | **mislabelled** (B25) |
| Stock adjustment | `inventory` PATCH | `manual_quick` with a Rs0 purchase/expense | **no** (B19) |
| SQL seeds | `supabase/seeds` | hand-picked values, some rewritten after insert | see B22 |

All four channels the brief names (scan, import, manual, voice) write a `source`. Only import is wrong (Excel), but two non-channel writers pollute `manual_quick`.

## 2. RLS: static inventory of migrations 001 to 008

Every tenant policy uses `store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text)`. `auth.uid()` is NULL for anon, so anon matches nothing.

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|---|
| stores | on | owner | owner | owner | **none** | No self-delete (fine). |
| products | on | store | store | store | store | |
| inventory | on | ALL store | ALL | ALL | ALL | |
| stock_movements | on | store | store | **none** | store (005) | No UPDATE (fine, append-only). |
| customers | on | ALL store | ALL | ALL | ALL | |
| fixed_costs | on | ALL store | ALL | ALL | ALL | |
| fixed_cost_overrides | on | ALL via parent fixed_cost | ALL | ALL | ALL | No explicit WITH CHECK; defaults to USING (fine). |
| transactions | on | store | store | store | store | |
| transaction_items | on | via parent tx | via parent tx | via parent tx (no WITH CHECK) | via parent tx | UPDATE without WITH CHECK lets a row move to another of the user's own tx only. |
| document_uploads | on | store | store and user_id = uid | **none** | **none** | B16: app updates silently fail. |
| extraction_corrections | on | ALL store | ALL | ALL | ALL | |
| ai_conversations | on | ALL store | ALL | ALL | ALL | |
| periodic_reports | on | store (001) + ALL owner (002) | ALL | ALL | ALL | 002's public share policy dropped in 003; verify live it is gone. Share page uses service role and matches the token in code. |
| cash_reconciliations | on | ALL store | ALL | ALL | ALL | |
| kaggle_products | **off** | anyone | anyone? | anyone? | anyone? | B28. |
| storage `documents` | n/a | `foldername[1] = uid` | same | **none** | **none** | Path is `{user_id}/...`; B16. |

Static verdict: **no cross-tenant read or write path in the migration files.** This is not proof. The policies were pasted into the SQL editor by hand, so the live DB may differ. `B-rls-proof.ts` checks, for every table and the bucket, whether user 2 or anon can:
- SELECT user 1's row by id
- UPDATE it (verified via service role)
- DELETE it
- INSERT into user 1's store
- reach storage (download, list, overwrite, plant, delete)
- write `kaggle_products`
- enumerate share tokens

It also records the B16 own-row UPDATE / own-file DELETE behaviour. Any `LEAK` row it prints is a P0.

Service-role use is limited to the cron handlers, report share and share page. In cron, `buildPeriodReport(svc, ...)` reads `fixed_cost_overrides` **without a store filter** (`buildReport.ts:61-64`). It is keyed by `fixed_cost_id`, so no cross-store numbers mix, but it loads every tenant's overrides on each store's run.

## 3. Atomic balance and stock (known bug, now with numbers)

`audit/tests/B-balance-race.test.ts` calls the real `POST` handlers of `entry/quick`, `entry/full`, `scan/confirm` and `customers/[id]/payment`, plus the real `updateStock`.

Observed across runs. Exact numbers vary with timer jitter; expected values in parentheses:

| Scenario | Observed | Expected |
|---|---|---|
| 2 overlapping credit sales of Rs10 | 10 | 20 |
| 20 concurrent credit sales via quick | 10, 10, 30 | 200 |
| 20 concurrent via full | 20, 40 | 200 |
| 20 concurrent via scan/confirm | 10, 10, 20 | 200 |
| Stock after those 20 quick/scan sales | 998-999 | 980 |
| 20 concurrent payments of Rs10 on Rs1000 | 990 | 800 |
| 10 sales + 10 payments together | 510 | 500 |
| `updateStock` x20 on an existing row | 98-99 | 80 |
| `updateStock` first insert, 5 x +10 | 10-20 | 50 |

Same request sequences fired one after another give exact results (control tests pass), so the fake is not the cause.

Receive-payment has the identical pattern (`payment/route.ts:62-92`). DELETE and void reversal (`transactions/[id]/route.ts:68-108,231-270`) also read-then-write both stock and balance.

Realistic triggers:
- a double-tapped Save
- the owner and a helper on two phones
- a payment recorded while a credit sale is saving

Fix direction, not implemented: one Postgres function per write that does `UPDATE ... SET current_balance = current_balance + $1` and `INSERT ... ON CONFLICT (store_id, product_id) DO UPDATE SET current_stock = inventory.current_stock + EXCLUDED.current_stock`, together with the transaction, items and movements in one DB transaction (also fixes B17).

## 4. Money correctness

Fixture, hand calculation and results are in the header of `audit/tests/B-money.test.ts`.

**Correct:**
- Cash position for the mixed day: cash in 450.50, cash out 350, drawer 1100.50, UPI 199.99.
- Daily profit with a fixed-cost override: sales 950, purchases 300, expenses 50, fixed 600, net 0, matching the hand calculation to the rupee.
- Udhaar sale counted in sales and in the credit breakdown, not in cash.
- Part payment counted in cash in, not in sales.

**Wrong:** B5 (GST zero), B6 (1000-row cap), B8 (cron), B10 (IST), B12 (scan purchase as cash), B13 (skipped-day carry), B14 (month fixed cost), B15 (paise float), B24 (rounding).

**Rounding and units:**
- Amounts are rupees with paise in `numeric(12,2)`.
- JS sums are float. The DB rounds on write, but in-memory sums (reconciliation, reports) are not rounded before comparison (B15).
- Reports round every figure to whole rupees independently (B24).
- No paise-vs-rupee unit confusion was found.

**Design note (not counted as a bug):** "gross margin" is `sales - purchases` for the period (cash basis), not sales minus cost of goods sold. A day with a big restock shows a loss even when every sale was at a profit.

## 5. snake_case vs camelCase

The browser never queries Supabase directly (only auth in login, signup and logout). Every data boundary is an `/api/*` JSON response.

| Consumer | API | Shape | Status |
|---|---|---|---|
| QuickEntry, FullEntryForm, ProductSearch, ProductCard, VariantManager | `/api/products` (raw rows) | snake | reads snake (`selling_price`), wrapped in `Number()`. OK |
| customers page | `/api/customers` | snake | normalised to camel at the fetch (`customers/page.tsx:70-78`). OK |
| CustomerLedger / ReceivePaymentSheet | `/api/customers/[id]` | snake | `Number(customer.current_balance)`, CreditBadge guards `isFinite`. OK |
| Inventory page, StockList, ExpiryAlert | `/api/inventory` | camel (mapped in route) | reads camel. OK |
| Transactions page, RecentTransactions | `/api/transactions` | camel with `Number(...) \|\| 0` | OK. Renders `₹{tx.totalAmount}` unformatted (₹1234.5, not ₹1,234.50). P3 cosmetic |
| Transaction detail rows | `/api/transactions/[id]` | snake | `Number(item.total_price)`. OK |
| Reconcile page | `/api/reconciliation` | camel | OK |
| FrequentItems | `/api/products/frequent` | `{id, name, price}` chips | OK |
| Reports | `buildPeriodReport` | camel, all `Math.round` | OK |
| Settings override | `/api/fixed-costs/[id]?month=` | snake | `Number(d.override.amount)`, but `if (d.override?.amount)` hides a Rs0 override that reports still apply. P3 |

No current path renders ₹NaN. The residual risk is that `types/index.ts` mixes snake (`Product`) and camel types for raw rows, so the compiler won't catch the next mismatch.

## 6. Seeds and sample vs real

- **Seeds were not run** (no dedicated DB). Static review: all SQL seeds and patches choose their store by name pattern (B9).
- The in-app sample store (`/api/stores/seed`) only inserts the caller's catalog and fixed costs, scoped by RLS. It does not mark them as sample.
- **Activity banner:** separates sample from real using only `notes` starting with `DEMO_SEED`, case-sensitive. Correct for app-created rows and properly tagged seeds. Wrong for:
  - untagged SQL rows (B22)
  - every other screen, which still includes demo rows (B21)
- **Can a real user see another store's seed data?** Not through the app. Every read is store-scoped and RLS-protected, and statically no cross-tenant policy path exists (proof pending `B-rls-proof.ts`). The realistic route is operational: a seed script writing demo data **into** a real store whose name matches (B9).

## 7. Delete and edit integrity

| Action | Stock | Customer balance | Verdict |
|---|---|---|---|
| Delete a sale (not voided) | reverted | reverted (credit sale or payment) | OK (test passes) |
| Void a sale | reverted | reverted | OK, but double reversal if later deleted (B4); stock_movements kept for voided tx, so consumption/inventory history still counts voided sales |
| Delete a voided sale | reverted **again** | reverted **again** | B4 |
| Change payment method (credit to cash/upi or back) | n/a | **not adjusted** | B3 |
| Edit items/qty of a sale | no endpoint | no endpoint | delete and re-enter is the only path (B26) |
| Delete a stock adjustment | **not reverted** | n/a | B19 |
| Delete a customer with balance | no API or UI exists | n/a | Cannot happen in-app. Via SQL, FK `ON DELETE SET NULL` makes their transactions anonymous and the receivable disappears from every total. |
| Delete a product used in past sales | soft delete (`is_active=false`) | n/a | History kept (items keep `product_name_raw`). Inactive product's stock is hidden from `/api/inventory` but can still be sold via `entry/quick` (no `is_active` check). Hard delete (SQL) cascades `inventory` and `stock_movements` (loses movement history); items set `product_id` NULL. |

---

## Files written by Session B

- `audit/findings-B.md` (this file)
- `audit/tests/B-fakeSupabase.ts`: in-memory supabase-js fake with latency, unique constraints, item-number trigger and max-rows model
- `audit/tests/B-vitest.config.ts`
- `audit/tests/B-balance-race.test.ts`: 12 tests (2 control pass, 10 fail)
- `audit/tests/B-integrity.test.ts`: 10 tests (2 pass, 8 fail)
- `audit/tests/B-money.test.ts`: 17 tests (5 pass, 12 fail)
- `audit/scripts/B-schema-diff.ts`: static schema vs code
- `audit/scripts/B-rls-proof.ts`: live two-tenant RLS and storage attack (not run, guarded)
- `audit/scripts/B-balance-race-live.ts`: live race confirmation (not run, guarded)

Next step to close the gaps:
1. Create a throwaway Supabase project.
2. Apply Prisma init, then 001 to 008, then `add_voided_at`, and create the private `documents` bucket.
3. Export the three `AUDIT_B_*` variables.
4. Run both live scripts, then `supabase/seeds` with the store name changed to the audit store.
