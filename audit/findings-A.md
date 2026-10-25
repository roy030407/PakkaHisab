# PakkaHisab audit: Session A findings (code health + security)

Date: 2026-10-14. Branch: `main` @ `50ea401`. Read-only audit; no app code was modified.

## Scope note (read first)

- `audit/PLAN.md`, `audit/INVENTORY.md` and `audit/BASELINE.md` did not exist when this session started (not on disk, not on any branch). I built my own baseline with `audit/scripts/A-baseline.sh`. If the coordinator's BASELINE differs, trust the one with the later timestamp and re-run my scripts.
- Only side effect outside `audit/`: `npm install --no-save @vitest/coverage-v8@4.1.8` (adds the coverage provider to `node_modules`; `package.json` and the lockfile are untouched).
- All raw outputs are in `audit/scripts/A-out/`. Scripts: `A-baseline.sh`, `A-coverage.sh`, `A-coverage-summary.cjs`, `A-deps.sh`, `A-emdash.sh`, `A-secrets.sh`, `A-lift.cjs`, `A-deadcode.cjs`.
- Verdicts: **CONFIRMED** = read in code and/or reproduced. **PLAUSIBLE** = strong code evidence, but needs a live DB or live model check to be certain (verification step given).

## Summary (severity-sorted)

| ID | Sev | Verdict | Area | Finding | Where |
|----|-----|---------|------|---------|-------|
| A-01 | High | CONFIRMED | Money math | No query paginates. PostgREST caps responses at 1000 rows by default, so reports, the activity card, frequent items and the advisor context silently drop rows once a period has >1000 transactions | `lib/reports/buildReport.ts:49`, 0 `.range()` calls in repo |
| A-02 | High | CONFIRMED | Data loss | CSV/Excel import sends only the 5 preview rows to `/api/import/confirm`, while the button says "Import N rows" | `app/(dashboard)/settings/page.tsx:645-649`, `:798` |
| A-03 | High | CONFIRMED | Security / cost | Any signed-up user can exhaust the shared Gemini quota for every merchant: scan 10/min, voice+chat+insight 20/min, `import/map` unlimited; all limits silently become "allow all" if Upstash env is missing | `lib/ratelimit.ts:40,80,86`, `app/api/import/map/route.ts` |
| A-04 | High | CONFIRMED | Dependencies | `next@14.2.35` has critical advisories with no 14.x fix (RSC DoS, cache poisoning, middleware redirect cache poisoning); fix requires a major upgrade | `package.json`, `A-out/npm-audit-high.txt` |
| A-05 | High | CONFIRMED | Dependencies | `xlsx@0.18.5` (prototype pollution + ReDoS, no npm fix) parses untrusted user uploads on the server | `lib/parsers/excel.ts`, `app/api/import/upload/route.ts:98` |
| A-06 | High | CONFIRMED | Tax | GST is always 0: every write path hard-codes `tax_amount: 0`, so the GST summary always shows ₹0 payable | `entry/quick:70,130`, `entry/full:100`, `scan/confirm:119`, `lib/reports/tax.ts` |
| A-07 | Medium | CONFIRMED | Ownership | `entry/quick` and `entry/full` write `customer_id` from the request body without checking it belongs to the caller's store; RLS only checks `store_id` | `app/api/entry/quick/route.ts:127`, `app/api/entry/full/route.ts:96` |
| A-08 | Medium | PLAUSIBLE | Reports | `periodic_reports.period_start` is a `date` but share + both crons write `MM-DD` strings; crons ignore the upsert error and still count success. Daily share also collides with the daily-insight cache row | `app/api/reports/share/route.ts:77-93`, `app/api/cron/*/route.ts:46-59` |
| A-09 | Medium | CONFIRMED | Money math | Day boundary is UTC on writes and dashboard but IST on the transactions page; sales between 00:00 and 05:30 IST land on the previous day | `entry/quick:65`, `dashboard:37` vs `transactions/route.ts:28` |
| A-10 | Medium | CONFIRMED | Money math | Balances and stock use read-modify-write with no DB transaction; multi-step saves can half-complete; concurrent void double-reverses | `entry/*`, `scan/confirm:233-247`, `customers/[id]/payment:86`, `transactions/[id]:209-277`, `lib/inventory/updateStock.ts:53-85` |
| A-11 | Medium | CONFIRMED (repo) | RLS | `document_uploads` has no UPDATE policy and storage has no DELETE policy, so scan status updates and orphan cleanup silently do nothing | `supabase/migrations/001_rls_policies.sql:162-172,231-244` |
| A-12 | Medium | CONFIRMED | Gemini errors | Scan failure shows the raw code `extraction_failed` to the merchant; scan and voice discard the error without logging; `import/map` has no try/catch, so a 404/429 leaves the import spinner stuck | `app/api/scan/route.ts:140`, `scan/page.tsx:101`, `import/map/route.ts:77`, `settings/page.tsx:616-622` |
| A-13 | Medium | CONFIRMED | Privacy | /privacy says bill photos are "only used to read your bill" (free-tier Gemini) and omits voice audio, advisor context (customer names + balances), PostHog identify (email, store name) and public share links | `app/privacy/page.tsx`, `lib/anthropic/advisor.ts:46-51`, `components/analytics/PostHogProvider.tsx:39` |
| A-14 | Medium | CONFIRMED | Privacy | Public report share links never expire and cannot be revoked; the same token is reused forever and crons refresh the row, so one shared link keeps exposing future reports (incl. per-item revenue) | `app/api/reports/share/route.ts:66-75` |
| A-15 | Medium | CONFIRMED | Tests | Every money module has 0% coverage: profit, tax, periods, buildReport, amounts, updateStock, resolve, consumption, suggestions | `A-out/coverage-summary.txt` |
| A-16 | Low | PLAUSIBLE | Gemini | Daily insight uses `maxOutputTokens: 100` on `gemini-flash-latest` (a thinking model); thinking tokens can consume the budget and return empty text, which is never cached, so each load re-bills | `lib/anthropic/insight.ts:57,43` |
| A-17 | Low | CONFIRMED | Validation | Entry routes accept any `type` string and any `quantity` (negative, NaN); scan confirm trusts client `totalAmount`; a crafted `type:"payment"` entry inflates balance when voided; `scan/correction` trusts `documentUploadId` | `entry/quick:66,107`, `entry/full:94,76`, `scan/confirm:113`, `scan/correction:68` |
| A-18 | Low | CONFIRMED | Auth | Open redirect shape in `auth/callback` (`${origin}${next}` with `next=.evil.com` or `@evil.com`); only reachable after a valid code exchange, and the password flow no longer uses this route | `app/api/auth/callback/route.ts:25,31` |
| A-19 | Low | CONFIRMED | Uploads | 10MB limits are unreachable on Vercel (4.5MB body cap, 413 is non-JSON, import client has no try/catch); import parses the body before the size check; scan trusts client MIME | `import/upload:46-54`, `scan/route.ts:72` |
| A-20 | Low | CONFIRMED | Cron | CRON_SECRET is verified but with a non-constant-time compare; crons loop every store sequentially under one 300s budget and swallow write errors | `app/api/cron/weekly-report/route.ts:25,43-63` |
| A-21 | Low | CONFIRMED | Dead code | Unused component, alias, helpers, types and the whole `@anthropic-ai/sdk` dep; `shadcn` CLI sits in runtime deps and drags in vulnerable `hono` / MCP SDK | see A-21 |
| A-22 | Low | CONFIRMED | Stale refs | Claude/Anthropic/OTP references are wrong in UI copy ("Claude is detecting columns…"), headers, README and CLAUDE.md | see A-22 |
| A-23 | Low | CONFIRMED | Repo rules | 67/138 raw `<button>`, 27/40 `<Link>` and 4/4 `<a>` lack a lift class (sample) | `A-out/lift.txt` |
| A-24 | Low | CONFIRMED | Cross-session | New untracked `eval/` folder (another session) adds 3 tsc errors under the root tsconfig; if committed it breaks `next build` | `eval/lib/text.ts:45,55`, `eval/lib/tasks/scan.ts:238` |
| A-25 | Low | CONFIRMED | Reports | Dashboard allocates fixed cost as monthly/30 while reports use days-in-month; `fixed_cost_overrides` query has no store filter (cron's service client loads every store's overrides) | `lib/reports/periods.ts:67`, `lib/reports/buildReport.ts:61-64` |
| A-26 | Info | CONFIRMED | Baseline | tsc 0 errors, lint 0 warnings, 110/110 tests pass, 0 skipped; vitest only collects `lib/**/*.test.ts`, so no route is tested | `A-out/` |
| A-27 | Info | CONFIRMED | Service role | Service-role key used in 4 server-only files; no client component imports a server module; no secret behind `NEXT_PUBLIC_` | see A-27 |
| A-28 | Info | CONFIRMED | Branches | All six stale branches are fully merged (0 commits ahead of main, local and origin); safe to delete | see A-28 |
| A-29 | Info | CONFIRMED | Secrets | No real key in git history; the committed `.env` (70c6bcd, removed in ba9f3c0) held a placeholder URL only | `A-out/secrets.txt` |
| A-30 | Info | CONFIRMED | Em dashes | 0 in app/, components/, lib/, hooks/, types/; 0 in last 50 commit messages; 5 left in SQL/Prisma comments; 15 older commits have them | `A-out/emdash.txt` |

## API route table (item 9)

"Auth" = `supabase.auth.getUser()` checked. "Ownership" = every DB read/write is scoped to the store derived from the session (never a `store_id` from the request), and every foreign ID from the request is verified against that store. **No route trusts a `store_id` from the body or query.** The gaps are foreign IDs other than `store_id`.

| Route | Methods | Auth | Ownership | Notes |
|---|---|---|---|---|
| `/api/activity` | GET | y | y | Unpaginated 28-day select (A-01) |
| `/api/ai/chat` | POST | y | y | `conversationId` update scoped by `store_id`. `messages` length and size unbounded; client can inject "assistant" turns (A-03). `getGeminiClient()` outside try (line 89) |
| `/api/ai/insight` | GET | y | y | Friendly error on failure |
| `/api/auth/callback` | GET | public (by design) | n/a | Open-redirect shape on `next` (A-18) |
| `/api/cron/weekly-report` | GET | CRON_SECRET | service role, all stores | A-08, A-20 |
| `/api/cron/monthly-report` | GET | CRON_SECRET | service role, all stores | A-08, A-20 |
| `/api/customers` | GET, POST | y | y | `type` not validated |
| `/api/customers/[id]` | GET, PATCH | y | y | `id` + `store_id` on every query |
| `/api/customers/[id]/payment` | POST | y | y | Amount and date validated. Balance read-modify-write (A-10) |
| `/api/dashboard` | GET | y | y | UTC "today" (A-09) |
| `/api/entry/full` | POST | y | **partial** | Products verified. **`customerId` not verified** (A-07). `quantity`, `unitPrice`, `type` unvalidated (A-17) |
| `/api/entry/quick` | POST | y | **partial** | Products verified, prices from DB. **`customerId` not verified** (A-07). `type`, `quantity` unvalidated |
| `/api/fixed-costs` | GET, POST | y | y | Good validation |
| `/api/fixed-costs/[id]` | GET, PUT, PATCH, DELETE | y | y | Cost ownership checked before override access. PUT returns raw `error.message` (line 163) |
| `/api/health` | GET | public | n/a | Fine |
| `/api/import/confirm` | POST | y | y | `rows` unbounded; `type`/`payment_method` copied from CSV unvalidated |
| `/api/import/map` | POST | y | n/a (no store lookup) | **No rate limit, no try/catch**, unbounded `headers` sent to Gemini (A-03, A-12) |
| `/api/import/template` | POST | y | y | Inventory and fixed-cost insert errors ignored |
| `/api/import/upload` | POST | y | n/a (no store lookup) | `formData()` before size check, no try; xlsx (A-05, A-19) |
| `/api/inventory` | GET, PATCH | y | y | Product verified. Adjustment creates a ₹0 `purchase`/`expense` transaction |
| `/api/inventory/suggest` | GET | y | y | |
| `/api/products` | GET, POST | y | y | Parent product verified. Search input sanitised for PostgREST `or()` |
| `/api/products/[id]` | GET, PATCH, DELETE | y | y | Field allowlist on PATCH |
| `/api/products/frequent` | GET | y | y | All-time sale IDs in one `.in()` (A-01) |
| `/api/reconciliation` | GET, POST | y | y | Recomputes sums server-side (good) |
| `/api/reports` | GET | y | y | `buildPeriodReport` not wrapped in try |
| `/api/reports/pdf` | GET | y | y | Same |
| `/api/reports/share` | POST, GET | POST y / GET public token | y | Service role used, store from session. GET: UUID-validated token. A-08, A-14 |
| `/api/scan` | POST | y | y | Rate limited. A-03, A-11, A-12 |
| `/api/scan/confirm` | POST | y | y | Doc, customer and product IDs all verified. `totalAmount` trusted (A-17) |
| `/api/scan/correction` | POST | y | partial | `documentUploadId` not verified (Low, A-17) |
| `/api/stores` | GET, POST, PATCH | y | y | Keyed by `owner_id` |
| `/api/stores/seed` | POST | y | y | |
| `/api/transactions` | GET | y | y | Customer name lookup relies on RLS (no `store_id` filter), acceptable |
| `/api/transactions/[id]` | GET, DELETE, PATCH | y | y | Void and delete race (A-10) |
| `/api/transactions/last` | GET | y | y | |
| `/api/voice/parse` | POST | y | y | Rate limited; error swallowed without log (A-12) |

Non-API: `app/share/[token]/page.tsx` uses the service role with `.eq('share_token', token)`; same exposure as A-14.

---

## Findings in detail

### A-01 (High, CONFIRMED) Report and analytics queries silently truncate at the PostgREST row cap

- Evidence: `grep -rn "\.range(" app lib` returns 0. `buildPeriodReport` selects every transaction in the period in one call (`lib/reports/buildReport.ts:49-55`). Supabase's hosted default `max_rows` is 1000; PostgREST returns the first 1000 rows with no error.
- Failure scenario: a kirana doing 40 sales/day passes 1000 rows in under a month. The monthly report, yearly report, PDF, share link and cron report all under-count sales, purchases, expenses, payment breakdown and top products, with no warning. Yearly reports hit this for almost any active store.
- Same pattern: `app/api/activity/route.ts:44` (28 days), `app/api/products/frequent/route.ts:39` (all-time sales, then one `.in()` with every ID, which also overflows URL length), `app/api/voice/parse/route.ts:164-177` (30 days, unchunked `.in()`), `lib/anthropic/advisor.ts` (90 days of transactions into the advisor). `buildReport` chunks `transaction_items` by 100 transactions but each chunk can still exceed 1000 items.
- Verify: check the project's API `max_rows` setting in Supabase dashboard; seed 1100 transactions in a test store and compare `/api/reports?period=monthly` to a SQL `sum()`.
- Fix direction: aggregate in SQL (RPC or view) for totals; page with `.range()` where rows are needed.

### A-02 (High, CONFIRMED) Import only ever imports 5 rows

- Evidence: `app/(dashboard)/settings/page.tsx:645-649` posts `rows: preview`; `preview` is `data.preview` from `/api/import/upload`, which is `rows.slice(0, 5)` (`app/api/import/upload/route.ts:109`). The in-code comment at `settings/page.tsx:638-640` admits it is "a simplified demo". The button reads `Import ${totalRows} rows` (`:798`).
- Failure scenario: merchant uploads a 600-product price list, taps "Import 600 rows", sees "5 rows imported". 595 rows are lost; if they do not read the result line, they believe the catalog is loaded.
- Fix direction: return all parsed rows (or a server-side temp ID) and confirm against those, or label the button truthfully until then.

### A-03 (High, CONFIRMED) Shared Gemini quota can be exhausted by one account; limiter fails open

- Evidence:
  - `lib/ratelimit.ts:40` returns `null` when `UPSTASH_REDIS_REST_URL`/`TOKEN` are missing, and `scanRateLimit`/`aiRateLimit` then return `{ success: true }` (`:80`, `:86`) with no log line. Production env is unknown to this session; both are set in `.env.local`.
  - With Upstash on: scan 10/min/user = 14,400/day, voice + chat + insight share 20/min/user. `lib/anthropic/client.ts:9` notes the free tier is 1500 req/day, so one user exhausts it for everyone in about 2.5 hours. Signup is open email + password.
  - `app/api/import/map/route.ts`: no rate limit, no store requirement, `headers` and `sampleRow` are sent to Gemini at any size.
  - `app/api/ai/chat/route.ts:98-101`: whole client-supplied `messages` array is forwarded, no cap on count or length (token burn, and the client can forge "model" turns).
- Failure scenario: a scripted account loops `/api/import/map` or `/api/scan`; every merchant's scan, voice and advisor start failing with 429.
- Fix direction: per-user daily caps, cap message count/size, rate-limit `import/map`, log loudly (or fail closed for AI routes) when Upstash is missing.

### A-04 (High, CONFIRMED) Next.js 14.2.35 has critical advisories with no patch on the 14 line

- Evidence (`A-out/npm-audit-high.txt`): `next` critical, fix only in `next@16.4.0` (major). Totals: 2 critical, 24 high, 11 moderate, 2 low.
- Advisories that apply to this app's shape (App Router on Vercel, middleware): RSC DoS (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-h25m-26qc-wcjf), RSC cache poisoning (GHSA-wfc6-r584-vfw7, GHSA-vfv6-92ff-j949), middleware redirect cache poisoning (GHSA-3g8h-86w9-wvmq), Server Actions DoS (GHSA-m99w-x7hq-7vfj). The Windows RCE and AVIF image-optimizer RCE do not apply (Vercel, no `next/image` in app code).
- Other high: `proxy-addr` critical (transitive, fix available), `postcss` high (direct, via next), `eslint-config-next` / `glob` (dev only).
- `npm outdated`: `next 14.2.35 -> 16.4.0`, `@supabase/supabase-js 2.108.0 -> 2.117.3`, `@supabase/ssr 0.10.3 -> 0.12.7`, `@google/genai 2.8.0 -> 2.29.1`, `prisma`/`@prisma/client 7.8.0 -> 7.10.0`.
- Fix direction: plan a Next 15/16 upgrade (async `cookies()`, `params` as Promise); bump the in-range packages now.

### A-05 (High, CONFIRMED) xlsx parses untrusted uploads; no fix on npm

- Evidence: `xlsx@0.18.5` (direct): GHSA-4r6h-8v6p-xvw6 prototype pollution and GHSA-5pgg-2g8v-p4x9 ReDoS, `fixAvailable: none`. Used server-side at `app/api/import/upload/route.ts:98` on any authenticated user's file.
- Failure scenario: a crafted workbook pollutes `Object.prototype` inside the serverless instance or pins the CPU until the function times out.
- Fix direction: switch to SheetJS's own CDN build (0.20.x) or another parser; parse in a worker with a timeout.

### A-06 (High, CONFIRMED) GST summary is always zero

- Evidence: every transaction insert writes `tax_amount: 0` (`app/api/entry/quick/route.ts:70,130`, `app/api/entry/full/route.ts:100`, `app/api/scan/confirm/route.ts:119`, `app/api/customers/[id]/payment/route.ts:81`, `app/api/inventory/route.ts:149`). `grep "tax_amount:" app lib | grep -v "tax_amount: 0"` finds no other writer. `calculateTax` (`lib/reports/tax.ts:20-37`) sums `tax_amount` only. Per-item `tax_rate` is stored on `transaction_items` but never used.
- Failure scenario: Reports and PDF show "GST payable ₹0" for a store selling 18% goods. CLAUDE.md lists "pay taxes correctly" as a core goal; a merchant relying on this underpays.
- Fix direction: compute tax from line items (`total_price * tax_rate / (100 + tax_rate)` for inclusive prices) at write time, or in the report.

### A-07 (Medium, CONFIRMED) Unverified `customerId` on manual entry

- Evidence: `app/api/entry/quick/route.ts:127` and `app/api/entry/full/route.ts:96` insert `customer_id: body.customerId ?? null` with no ownership check. RLS `transactions_store_insert` (`001_rls_policies.sql`) checks only `store_id`; the FK accepts any existing customer ID. Contrast `scan/confirm/route.ts:92-101`, which verifies.
- Failure scenario: a user posts a sale with another store's customer UUID. The row persists with a foreign `customer_id`. No balance changes (the balance select is store-scoped) and no data is read back (the name lookup is RLS-filtered), so impact is integrity, not disclosure. It still breaks the "every foreign ID is verified" rule.
- Fix direction: reuse the scan/confirm check; consider a composite FK `(store_id, customer_id)`.

### A-08 (Medium, PLAUSIBLE) Share links and cron reports likely fail to save; daily share collides with the insight cache

- Evidence:
  - `period_start` is `@db.Date` (`prisma/schema.prisma:299`). Share and both crons write `report.cashFlowData[0]?.date`, but `buildCashFlowData` formats that as `label.slice(5)` = `MM-DD` for daily/weekly/monthly and `YYYY-MM` for yearly (`lib/reports/periods.ts:154`). Neither is a valid Postgres date.
  - Crons `await svc.from('periodic_reports').upsert(...)` without reading `error` and then `generated++` (`app/api/cron/weekly-report/route.ts:46-59`), so failures report as success.
  - The unique key is `(store_id, report_type)` (`002_share_tokens.sql:19-21`). The daily insight cache also writes `report_type: 'daily'` (`lib/anthropic/insight.ts:64-74`). If share ever succeeds for `period=daily`, the insight read (`:35-45`) returns "Today report for <store>" as the AI insight, and the insight upsert then sets `report_json: null` under the shared token, breaking the share page.
- Verify: in Supabase SQL, `select '10-14'::date;` and `select report_type, period_start, share_token is not null from periodic_reports;`. Or click Share on /reports.
- Fix direction: use `bounds.start`/`bounds.end` ISO dates; check upsert errors; give the insight cache its own `report_type`.

### A-09 (Medium, CONFIRMED) UTC vs IST day boundary

- Evidence: writes use `new Date().toISOString().split('T')[0]` (UTC) in `entry/quick:65,124`, `entry/full:50`, `scan/confirm:111`, `customers/[id]/payment:49`, `inventory:144`; dashboard uses UTC (`dashboard/route.ts:37`); `transactions/route.ts:28-30` uses `Asia/Kolkata`. `getPeriodBounds` uses server-local time then `toISOString()` (`lib/reports/periods.ts:27-53`, `buildReport.ts:43-46`).
- Failure scenario: a sale at 01:00 IST on 15 Oct is stored with date 14 Oct. It shows in "yesterday" on the dashboard and does not appear under "today" on /transactions. On a machine running in IST (dev, or any non-UTC host), monthly bounds shift one day earlier and `reportMonth` picks the previous month's fixed-cost overrides.
- Fix direction: one `todayIST()` helper used by every write and read.

### A-10 (Medium, CONFIRMED) Non-atomic money and stock writes

- Evidence: balances are read then written as `old + delta` (`entry/quick:165-177`, `entry/full:136-148`, `scan/confirm:233-247`, `customers/[id]/payment:62-92`, `transactions/[id]:95-107,257-270`). Stock does the same in `lib/inventory/updateStock.ts:53-72`. Line items are inserted one by one after the transaction row, with insert errors ignored (`entry/quick:137-147`, `scan/confirm:189-191` only logs). Void checks `voided_at` then reverses, with no lock (`transactions/[id]:216-277`). First inventory insert clamps a negative delta to 0 (`updateStock.ts:78`), so voiding that sale later adds stock that never existed.
- Failure scenario: voice sale and manual payment for the same customer at once: one balance update is lost. Void from the dashboard and from /transactions (two tabs): stock and balance are reversed twice. A network drop mid-save leaves a transaction with half its items and stale stock.
- Fix direction: Postgres RPCs doing the whole save in one transaction with `update ... set current_balance = current_balance + $1`; conditional void `update ... where voided_at is null returning *`.

### A-11 (Medium, CONFIRMED in repo migrations) Missing UPDATE / DELETE policies make writes silently no-op

- Evidence: `document_uploads` has only SELECT and INSERT policies (`001_rls_policies.sql:162-172`); no later migration adds UPDATE. `storage.objects` has only INSERT and SELECT for bucket `documents` (`:231-244`).
- Effect: `scan/route.ts:143-146,171-178` and `scan/confirm/route.ts:250-254` updates match 0 rows under RLS (no error), so `extraction_status` stays `pending`, `raw_extraction_json` is never stored and "confirmed" is never recorded. The failure-path `storage.remove()` (`scan/route.ts:122,142`) cannot delete, so failed scans leave orphan files.
- Verify: Session B / live DB `select polname, polcmd from pg_policy where polrelid = 'document_uploads'::regclass;` and the same for `storage.objects`.

### A-12 (Medium, CONFIRMED) Gemini failure handling (item 7)

- Model name: set once at `lib/anthropic/client.ts:30` (`process.env.GEMINI_MODEL ?? "gemini-flash-latest"`). All 5 call sites use `DEFAULT_GEMINI_MODEL`: `extraction.ts:90`, `voiceParse.ts:67`, `insight.ts:53`, `ai/chat/route.ts:104`, `import/map/route.ts:78`. **GEMINI_MODEL is honoured everywhere.** It is missing from `.env.local.example`. No call sets a timeout; only `vercel.json` `maxDuration` bounds them (`voice/parse` and `import/map` have no entry, so they get the platform default).
- Per path, on 404 (retired model), 429 (quota) or timeout:

| Path | Server behaviour | What the merchant sees |
|---|---|---|
| Scan `/api/scan` | `catch {}` with no log (`:140`), returns `{error:'extraction_failed'}` 422 | The literal text "extraction_failed" (`scan/page.tsx:101,200`). Violates UX rule 7. Vercel timeout: HTML 504, `res.json()` throws, then "Could not process the image" (fine) |
| Voice `/api/voice/parse` | `catch {}` with no log, 422 | Status "error" only, no reason (`useVoiceSession.ts:53`) |
| Chat `/api/ai/chat` | Logged; SSE error with `friendlyAIError` | Friendly message. 404 maps to the generic "could not answer right now". Missing API key throws before the stream (line 89) as a bare 500 |
| Insight `/api/ai/insight` | Logged; 500 with friendly text | Friendly message |
| Import map `/api/import/map` | **No try/catch** around `generateContent` (`:77-84`): unhandled throw, 500 with non-JSON body | `mapRes.json()` throws inside `handleUpload`, which has no try/catch (`settings/page.tsx:616-622`), so `mappingLoading` and `uploading` never reset: **spinner stuck** |

- The July 2026 model retirement noted in `client.ts:28` would have been invisible in logs for scan and voice for this reason.

### A-13 (Medium, CONFIRMED) Privacy copy vs actual data flows (item 12)

- `TODO(privacy)`: none found. `[CONTACT_PLACEHOLDER]`: only in `docs/superpowers/specs/2026-06-14-data-privacy-messaging-design.md:85,88`; the live page uses a real address. **No "not used for training" claim exists in UI copy**; `app/privacy/page.tsx:13-17` explicitly forbids adding one.
- Gaps on `/privacy` (last updated 14 June 2026, before voice shipped):
  - "Reading your bills ... This is only used to read your bill." The header says the stack is a free-tier cloud AI provider, whose terms allow use of inputs to improve the service. This sentence overstates.
  - Not disclosed: voice audio sent to Gemini (`lib/anthropic/voiceParse.ts`); advisor and daily insight send 90 days of totals plus top-5 customer names and balances (`lib/anthropic/advisor.ts:46-51,128`); PostHog `identify(userId, { email, store_name })` with default autocapture (`components/analytics/PostHogProvider.tsx:39`, `lib/analytics/posthog.ts:29-35`); Umami.
  - "Only you see your books" while public share links exist (A-14).
- `.env.local.example` lacks `NEXT_PUBLIC_POSTHOG_KEY`/`HOST` and `GEMINI_MODEL`.

### A-14 (Medium, CONFIRMED) Share links never expire and keep updating

- Evidence: `app/api/reports/share/route.ts:66-75` reuses the existing `share_token` "so previously distributed links remain valid". There is no expiry column, no revoke route, and crons upsert fresh `report_json` into the same `(store_id, report_type)` row (token preserved). `report_json` includes `itemsSold` (full per-product revenue).
- Failure scenario: a merchant shares one monthly report with a supplier; that URL keeps showing every future month's numbers.
- Fix direction: per-share snapshot rows with `expires_at`, plus a revoke button.

### A-15 (Medium, CONFIRMED) Test coverage gaps on money math (item 3)

`audit/scripts/A-coverage.sh` (v8, all of `lib/` excluding generated Prisma): **31.95% lines, 32.21% branches**. Zero-coverage modules, money first:

| Priority | Module | Lines | Why it matters |
|---|---|---|---|
| 1 | `lib/reports/profit.ts` | 0% | Net profit on every report |
| 1 | `lib/reports/tax.ts` | 0% | GST (A-06) |
| 1 | `lib/reports/periods.ts` | 0% | Period bounds, fixed-cost allocation, chart buckets (A-08, A-09) |
| 1 | `lib/reports/buildReport.ts` | 0% | All report totals (A-01) |
| 1 | `lib/inventory/updateStock.ts` | 0% | Stock math (A-10) |
| 1 | `lib/parsers/amounts.ts` | 0% | Indian amount parsing on import |
| 2 | `lib/scan/resolve.ts` | 0% | Price/qty resolution glue after `inferQtyPrice` |
| 2 | `lib/inventory/consumption.ts`, `suggestions.ts` | 0% | Stockout predictions |
| 3 | `lib/parsers/csv.ts`, `excel.ts`, `lib/anthropic/*`, `lib/ratelimit.ts` | 0% | |

Well covered: `cashReconciliation` (reconcile) 100%, `transactions/reverse` (balances on void) 100%, `inferQtyPrice` 93%, `voice/cart` 100%, `scan/match` 95%, `collections/aging` 100%. Customer balance arithmetic itself lives inline in API routes (A-10) and has no test.

### A-16 (Low, PLAUSIBLE) Insight output budget

- `lib/anthropic/insight.ts:57` sets `maxOutputTokens: 100`. Gemini 2.5+ flash models count thinking tokens against this budget, so the visible text can be empty or cut mid-sentence. An empty string fails `if (cached?.summary_text)` (`:43`), so every dashboard load calls Gemini again.
- Verify: log `result.usageMetadata` once in a dev run.

### A-17 (Low, CONFIRMED) Input validation gaps on own-store writes

- `type` is a free string (no enum or check constraint, `prisma/schema.prisma:199`) and is not validated in `entry/quick` or `entry/full`. A crafted `type: "payment"` with `customerId` stores a payment that never reduced the balance; voiding it then **adds** the amount to the balance (`lib/transactions/reverse.ts:62-64`).
- `quantity` is not validated (negative, zero, NaN, string) in `entry/quick:107`, `entry/full:76`, `scan/confirm`. A negative sale quantity raises stock and lowers the total.
- `scan/confirm` stores client `totalAmount` (`:113`) and adds it to the customer balance (`:243`) without reconciling against line items.
- `scan/correction:68` accepts any `documentUploadId` (FK can point at another store's upload).
- `inventory` PATCH: `delta` sent as a string becomes string concatenation in `Number(existing) + delta` (`updateStock.ts:61`).

### A-18 (Low, CONFIRMED) Redirect target from query string in auth callback

- `app/api/auth/callback/route.ts:25,31`: `NextResponse.redirect(`${origin}${next}`)`. `next=.evil.com` gives `https://app.example.evil.com`; `next=@evil.com` gives userinfo-style `https://app.example@evil.com`.
- Only taken after `exchangeCodeForSession` succeeds, which needs a valid PKCE code in the victim's browser, and login/signup now use passwords (`login/page.tsx:63`, `signup/page.tsx:68`) and never point here. Low, but the route is live. Fix: require `next` to start with a single `/`.

### A-19 (Low, CONFIRMED) Upload limits (item 11)

| Route | Type check | Size check | Notes |
|---|---|---|---|
| `/api/scan` | client-declared `file.type` in JPEG/PNG/WebP, no magic bytes | 10MB after full body read | Client compresses to 1.5MB / 1280px, so normal use is fine. Rate limited (A-03) |
| `/api/voice/parse` | client MIME allowlist | 5MB | Rate limited |
| `/api/import/upload` | extension or MIME, plus PK/OLE magic bytes for Excel | 10MB, but checked **after** `request.formData()` with no try | No rate limit; xlsx (A-05) |

Vercel caps serverless request bodies at 4.5MB, so every limit above 4.5MB is unreachable. The 413 comes back as non-JSON; the import client calls `res.json()` with no try/catch (`settings/page.tsx:601-602`) and hangs. Scan uploads cannot burn quota by size (Gemini sees a ≤4.5MB image); they burn it by count (A-03).

### A-20 (Low, CONFIRMED) Cron routes (item 10)

- `CRON_SECRET` is verified in both routes: missing secret means 401, header must equal `Bearer <secret>` (`weekly-report/route.ts:23-27`, `monthly-report/route.ts:23-27`). The string compare is not constant-time (minor).
- Both run every store sequentially within one `maxDuration: 300` and ignore upsert errors (A-08). They will time out as stores grow.
- Rate limiting: Upstash is used only by `/api/scan` (`scanRateLimit`), `/api/voice/parse`, `/api/ai/chat`, `/api/ai/insight` (`aiRateLimit`, one shared 20/min bucket). Missing env means no limiting and no log (A-03). No app-level auth rate limit; CLAUDE.md's "Auth: 5 req/min/IP" relies on Supabase's built-in limits since login runs client-side.

### A-21 (Low, CONFIRMED) Dead code and unused dependencies (item 4)

From `audit/scripts/A-deadcode.cjs` (heuristic, hand-checked):
- Unused file: `components/dashboard/DashboardQuickSale.tsx` (no importer; `PaymentToggle.tsx:13,16` header still lists it).
- Unused exports: `getAnthropicClient` alias (`lib/anthropic/client.ts:42`), `getTodayBounds` (`lib/reports/periods.ts:56`), types `InventoryItem` and `ApiError` (`types/index.ts`). Many other exported types are used only in their own file (harmless).
- Unused dependency: `@anthropic-ai/sdk` (no import anywhere). `ANTHROPIC_API_KEY` is still in `.env.local` and unused.
- `shadcn` (a CLI) is in `dependencies`; it pulls in `@modelcontextprotocol/sdk`, `hono`, `ts-morph`, `fast-glob` and much of the high-severity audit list. Move to `devDependencies` or remove.
- Empty directories: `lib/razorpay/`, `lib/utils/` (CLAUDE.md expects `lib/utils/fuzzy.ts`).
- Seeds: `stores/seed` maps only kirana, medical, pharmacy, hardware (`app/api/stores/seed/route.ts:40-43`); restaurant, clothing and electronics stores get "No sample data".
- `nul` file at repo root (Windows artifact, gitignored).

### A-22 (Low, CONFIRMED) Stale Claude / Anthropic / OTP references (item 4)

- User-visible: `app/(dashboard)/settings/page.tsx:750` "Claude is detecting columns…" (Gemini does this).
- Auth is email + password (`login/page.tsx:63`, `signup/page.tsx:68`), but README (`README.md:36`), CLAUDE.md (1a, tech stack), `app/api/auth/callback/route.ts:5-13` and `lib/supabase/browser.ts:13` still describe email OTP / magic link.
- Header comments that no longer match content: `app/api/ai/chat/route.ts:5-12` ("calls claude-sonnet-4-6"), `app/api/ai/insight/route.ts:6`, `app/api/scan/route.ts:6` ("Claude Vision"), `lib/anthropic/advisor.ts:5,13`, `lib/anthropic/insight.ts:5,11-12,62`, `lib/anthropic/prompts.ts:5`, `lib/ratelimit.ts:18-22` (omits voice), `lib/supabase/server.ts:48` ("never in user-facing routes", but `reports/share` and `share/[token]` use it), `app/api/stores/route.ts:112-113` (wantsSampleStore flag not stored).
- The directory `lib/anthropic/` holds only Gemini code.
- CLAUDE.md tech stack still says Anthropic Claude for extraction and advisor.

### A-23 (Low, CONFIRMED) Lift / hover utilities (item 6, sample)

`audit/scripts/A-lift.cjs` parses JSX in `app/` and `components/` (excluding `components/ui`, whose shadcn `Button` already lifts). Cursor rules are global in `app/globals.css:294-301`, so cursor is fine everywhere.
- Raw `<button>`: 67 of 138 without a lift class. Examples: `app/(auth)/login/page.tsx:130,140`, `app/(auth)/onboarding/page.tsx:168,179`, `app/(dashboard)/inventory/page.tsx:119`, `ledger/page.tsx:131`, `reports/page.tsx:111`, `scan/page.tsx:201`, `settings/page.tsx:316-338`.
- `<Link>`: 27 of 40 without; `<a>`: 4 of 4 without (mostly text links on landing, privacy, terms; arguably exempt).
- Clickable `div`/`li`: 5 of 7 without; `ReceivePaymentSheet.tsx:72-73`, `CustomerSheet.tsx:57`, `StockList.tsx:120-121`. Some are sheet backdrops (exempt).
- Full list: `audit/scripts/A-out/lift.txt`.

### A-24 (Low, CONFIRMED) New `eval/` folder breaks the root type check

- `git status` shows untracked `e2e/` and `eval/` created during this audit by another session. `tsconfig.json` includes `**/*.ts` and excludes only `node_modules`. A re-run of `tsc --noEmit` now fails with 3 errors: `eval/lib/text.ts(45,22)` and `eval/lib/tasks/scan.ts(238,20)` TS2802, `eval/lib/text.ts(55,32)` TS1501. My first run (before `eval/` existed) was clean.
- If `eval/` is committed, `next build` (which type-checks the same include set) fails on Vercel. Fix: add `"eval"`, `"e2e"` and `"audit"` to `exclude`, or give them their own tsconfig.

### A-25 (Low, CONFIRMED) Fixed-cost allocation inconsistencies

- Dashboard: `fixedCostForPeriod(costs, 1)` uses monthly/30 (`lib/reports/periods.ts:67`); monthly report uses days in month (`:85`). In a 31-day month, the sum of daily dashboard costs exceeds the monthly report's figure.
- Monthly overrides are ignored by the dashboard (only `buildReport` reads them).
- `buildReport.ts:61-64` queries `fixed_cost_overrides` by month only. Safe under user RLS; under the cron's service role it loads every store's overrides (correct result, wasted rows).

### A-26 (Info) Baseline (items 1 and 2)

- `tsc --noEmit`: 0 errors (`A-out/tsc.txt`). After `eval/` appeared: 3 errors (A-24).
- `next lint`: "No ESLint warnings or errors" (`A-out/lint.txt`).
- `vitest run`: 14 files, 110 tests passed, 0 failed, 0 skipped; no `.skip`, `.only` or `.todo` in any test file. Item 2 therefore has nothing to classify.
- `vitest.config.ts` only includes `lib/**/*.test.ts`: no API route, component or hook is tested, which is how A-02, A-06 and A-07 went unnoticed.

### A-27 (Info) Service-role key usage (item 8)

| File | Context | Server-only? |
|---|---|---|
| `lib/supabase/server.ts:49-57` | defines `createSupabaseServiceClient` | Yes; also imports `next/headers`, so a client import would fail the build |
| `app/api/cron/weekly-report/route.ts:29` | cron | Yes |
| `app/api/cron/monthly-report/route.ts:29` | cron | Yes |
| `app/api/reports/share/route.ts:64,112` | POST (store from session), GET (token) | Yes |
| `app/share/[token]/page.tsx:32` | Server Component (no `"use client"`) | Yes |

- None of the 61 `"use client"` files imports `lib/supabase/server`, `lib/anthropic/*`, `lib/ratelimit`, `next/headers` or a server-only lib. The lib modules clients do import (`posthog`, `collections/*`, `share/receipt`, `voice/*`, `utils`) import nothing server-side.
- Public env vars: `NEXT_PUBLIC_SUPABASE_URL`, `_ANON_KEY`, `_APP_URL`, `_POSTHOG_KEY`, `_POSTHOG_HOST`, `_UMAMI_WEBSITE_ID`. No secret.
- Hardening: add `import 'server-only'` to `lib/supabase/server.ts` and `lib/anthropic/client.ts`.

### A-28 (Info) Stale branches (item 4)

| Branch | Ahead of main | Behind main | origin copy ahead of main |
|---|---|---|---|
| `slice-a-collections` | 0 | 80 | 0 |
| `voice-layer-1` | 0 | 58 | 0 |
| `voice-layer-3` | 0 | 54 | 0 |
| `voice-layer-4` | 0 | 48 | 0 |
| `feat/phase-2-bill-scanning` | 0 | 175 | (local only) |
| `feat/phase-3-inventory` | 0 | 158 | (local only) |

All appear in `git branch --merged main`. Safe to delete locally and on origin.

### A-29 (Info) Secrets in git history (item 13)

- `audit/scripts/A-secrets.sh` scans `git log --all -p` for `AIza…`, JWT `eyJ…`, `sk-ant-`, `sk-…`, `phc_…`, Postgres URLs with passwords, Upstash tokens and CRON_SECRET values, printing commit and file only.
- One hit: `70c6bcd .env.local.example` (Postgres URL). The password segment is a placeholder.
- Commit `70c6bcd` also added a tracked `.env` (removed in `ba9f3c0`). Its only key, `DATABASE_URL`, has no `user:password@` part (placeholder).
- No real key found. `.env*.local` is gitignored; only `.env.local.example` is tracked.

### A-30 (Info) Em dashes (item 6)

- `app/`, `components/`, `lib/`, `hooks/`, `types/`, `data/`, `middleware.ts`, `README.md`: 0.
- Remaining: `supabase/migrations/001_rls_policies.sql` (2), `003_fix_share_rls.sql` (1), `004_id_defaults.sql` (1), `prisma/schema.prisma` (1), all in comments.
- Last 50 commit messages: 0. All-time: 15 older commits (for example `70c6bcd`), not worth rewriting history for.
