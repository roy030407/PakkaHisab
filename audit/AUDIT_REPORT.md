# PakkaHisab Audit Report (consolidated)

Merged from findings-A (code + security), findings-B (data + money), findings-C (AI pipelines), findings-D (end-to-end). Session 0 (baseline) and Session E (production) did not run. B and D could not run against a live database. Save as `audit/AUDIT_REPORT.md`.

---

## 1. Verdict

**Not safe to put in front of a new merchant yet.** Three reasons, in order:

1. **The app is probably down.** The Supabase project `ydvbjofgtqvlipibxgqc` returns NXDOMAIN, which looks like a paused or deleted free-tier project (C3, D B-1). Every login and every API call fails.
2. **The AI cannot handle one merchant's day.** The Gemini key is on a free tier capped at 20 requests per day on `gemini-flash-latest`, shared by scan, voice (one call per spoken phrase), advisor, insight and import (C1). One busy hour of voice uses it up.
3. **Money can be wrong without anyone noticing.** Udhaar balances and stock lose updates on concurrent saves, a Cash tap after a credit sale leaves udhaar inflated forever, and void followed by delete reverses twice (B1 to B4).

The good news: tsc, lint and all 110 tests are clean, no route trusts a `store_id` from the request, no secrets are in git history, and static RLS review found no cross-tenant path. The foundation is sound. The problems are concentrated in a small number of files.

---

## 2. Unblock first (before any fixing)

| # | Action | Why |
|---|---|---|
| U1 | Open the Supabase dashboard. If the project shows Paused, restore it. If it is gone, recreate it and apply migrations in this order: Prisma init, `supabase/migrations` 001 to 008, Prisma `add_voided_at`, then create the private `documents` bucket (B23). | Everything else is blocked on this. |
| U2 | Create a second, throwaway Supabase project for audit and tests. Never point test scripts at production again. | B correctly refused to write to the main project. |
| U3 | Fix the Gemini quota: enable billing on the Google AI project behind the key and set a monthly budget alert. Use a separate key for evals. | C1. 20 requests/day makes voice unusable regardless of any other fix. |
| U4 | Add `"eval"`, `"e2e"`, `"audit"` to `exclude` in `tsconfig.json` before committing those folders. | A-24. Otherwise `next build` fails on Vercel. |
| U5 | Commit all audit output (`audit/`, `eval/`, `e2e/`) to a branch so nothing is lost. Keep `eval/fixtures` private files gitignored. | |
| U6 | Then run the live proofs: B's `B-rls-proof.ts` and `B-balance-race-live.ts` against the audit project, D's 12 blocked journeys, and Session E. | Only then can RLS be called safe (P0 status is still open). |

---

## 3. Deduplicated findings

IDs from the session files are kept so you can look up evidence. "Lane" is the fix lane in section 5.

### Wave 0: must fix before any merchant uses it

| ID | Finding | Source IDs | Lane | Effort |
|---|---|---|---|---|
| W0-1 | Lost updates on `customers.current_balance` and `inventory.current_stock`; multi-step saves not atomic; first-insert stock race; negative clamp drops stock | B1, B2, B17, A-10 | 1 | M |
| W0-2 | Cash/UPI toggle after a credit sale changes `payment_method` without touching udhaar; toggle also highlights UPI after a credit sale | B3, D F-01 | 1 | S |
| W0-3 | Void then Delete reverses stock and balance twice; `set_payment` allowed on voided rows | B4, B26 | 1 | S |
| W0-4 | Scan confirm drops line items when 2+ new products are added (item_number trigger collision) | B7 | 1 | S |
| W0-5 | Input validation: negative/NaN quantity, free-text `type`, credit sale with no customer, client-supplied scan `totalAmount`, unverified `customerId` and `documentUploadId` | A-17, B18, A-07, B27 | 1 | S |
| W0-6 | Missing RLS: `document_uploads` has no UPDATE policy, storage has no DELETE policy, so scan status and cleanup silently no-op. Verify live first. `kaggle_products` has RLS off | A-11, B16, B28 | 1 | S |
| W0-7 | Seed scripts target any store whose name matches `%ram kirana%` and bypass RLS | B9 | 1 | S |
| W0-8 | Gemini: no retry, no fallback model, errors swallowed without logs, merchant sees "extraction_failed", import spinner hangs | C1, C10, A-12 | 2 | M |
| W0-9 | Shared AI quota abuse: `import/map` unlimited, chat messages unbounded, limiter fails open without Upstash | A-03 | 2 | S |
| W0-10 | Import says "Import N rows", imports 5 | A-02, D F-02 | 3 | S |
| W0-11 | No forgot-password flow | D F-04 | 3 | S |

### Wave 1: core daily loop correct (voice sale, quick entry, udhaar, din ka hisab, scan)

| ID | Finding | Source IDs | Lane | Effort |
|---|---|---|---|---|
| W1-1 | UTC vs IST day boundary on writes, dashboard, reconcile, reports (35 call sites). One `todayIST()` helper | A-09, B10, D F-12 | 1 | M |
| W1-2 | Cash sales default to UPI (voice, dashboard tap, quick entry, scan), so Din ka hisab expected cash is wrong; scan purchases always saved as cash | B11, B12 | 1 + 2 (voice page) | S |
| W1-3 | Reconcile: carry-forward skips unclosed days; float paise makes "Tally" fail | B13, B15 | 1 | S |
| W1-4 | Scan output truncated: thinking tokens eat `maxOutputTokens`, 15 to 26% of bills fail outright | C4 | 2 | S |
| W1-5 | Scan money errors: no check of line sum vs printed total; prices read as quantities; line totals as unit prices | C5 | 2 | M |
| W1-6 | Catalog matcher picks wrong products (Tata Salt to Toor Dal); voice auto-accepts weak matches; prompt over-translates Hindi names; voice bias list brand-prefixed | C6, C12, C13 | 2 | M |
| W1-7 | Voice VAD likely never fires in shop noise (fixed threshold); no max segment; no pre-roll | C2, C8 | 2 | M |
| W1-8 | Voice hallucinates items from silence; "Ek Bikaji" heard as close command; blank page becomes a high-confidence bill | C7, C11 | 2 | S |
| W1-9 | Voice cart races: late segments after khatam, rows wiped during save, retry duplicates the session and leaks the mic | C9 | 2 | M |
| W1-10 | iPhone: `audio/webm` MediaRecorder may be unsupported; TTS English only and may be blocked | C16 | 2 | S |
| W1-11 | Scan review defaults to Sale even for supplier bills | D F-06 | 3 | S |
| W1-12 | Tap targets under 44px on the most-used buttons; login inputs 32px | D F-03, F-22 | 3 | S |
| W1-13 | No Add customer / edit phone on /customers; phone with leading 0 gives no WhatsApp link | D F-13, F-14 | 3 | S |
| W1-14 | Restaurant and clothing sample catalogs exist but are not wired; new products have no inventory row so the Stock page is empty | D F-05, F-17, A-21 | 3 | S |
| W1-15 | Dashboard page throws on logged-out hit (`user!.id`) | D F-23 | 3 | S |

### Wave 2: correctness at scale, honesty, security hygiene

| ID | Finding | Source IDs | Lane | Effort |
|---|---|---|---|---|
| W2-1 | All queries capped at 1000 rows; reports undercount past that. Move totals into SQL | A-01, B6 | 1 | M |
| W2-2 | Cron and share: wrong period, `MM-DD` written to a date column, errors ignored, daily share collides with insight cache | A-08, B8 | 1 | S |
| W2-3 | Share links never expire, cannot be revoked, keep updating | A-14 | 1 | S |
| W2-4 | Fixed cost per month does not equal the entered amount; dashboard ignores overrides | B14, A-25 | 1 | S |
| W2-5 | Sample vs real: demo rows included in today/MTD, reports, GST, advisor; untagged SQL inserts count as real usage; `patch-sources.sql` rewrites source values | B21, B22 | 1 | S |
| W2-6 | Privacy page overstates and omits voice audio, advisor data, PostHog identify, share links | A-13 | 3 | S |
| W2-7 | `xlsx@0.18.5` parses untrusted uploads (no npm fix) | A-05 | 3 | S |
| W2-8 | Corrections few-shot stores auto-matches, not human edits, and never qty/price | C14 | 2 | S |
| W2-9 | Scan latency p50 11 to 13 s vs copy saying 5 to 15 s; voice route has no `maxDuration` | C15 | 2 | S |
| W2-10 | Import: Excel labelled csv_import, free-text type/payment, no balance effects; stock adjustment writes a Rs0 transaction | B19, B20 | 3 | S |
| W2-11 | Money modules at 0% coverage; no route tests at all | A-15, A-26 | all | M |

### Wave 3: upgrades, polish, cleanup

| ID | Finding | Source IDs | Effort |
|---|---|---|---|
| W3-1 | Next.js 14.2.35 critical advisories, fix needs Next 15/16 | A-04 | L |
| W3-2 | GST always zero. Decide: compute from `tax_rate`, or hide the GST summary until it is real | A-06, B5, D F-09 | M (or S to hide) |
| W3-3 | Ledger capture: total uses unit price, never saves, no nav link | D F-07, F-08 | S (or hide) |
| W3-4 | Full entry: expense/income have no amount field; literal `&#10003;` text | D F-10, F-11 | S |
| W3-5 | No edit for a saved transaction | D F-19, B26 | M |
| W3-6 | Din ka hisab and ledger have no nav link or date picker; expiry only via CSV; PDF copy on scan upload | D F-15, F-16, F-18, C17 | S |
| W3-7 | Dead code, `@anthropic-ai/sdk` unused, `shadcn` in runtime deps, stale Claude/OTP references, lift classes, em dashes in SQL comments, 6 merged branches | A-21, A-22, A-23, A-28, A-30 | S |
| W3-8 | Profit rounding off by Rs1 to 2; `/api/health` says ok with DB down; unknown API routes return HTML; open-redirect shape in auth callback; upload limits above Vercel's 4.5MB cap | B24, B25, D F-20, F-21, A-18, A-19, A-20 | S |
| W3-9 | Two migration systems; no CHECK constraints on type/source/payment_method | B23 | M |

### Product call worth making now

Several broken items are features a kirana owner does not need in week one: GST summary, ledger capture, full entry for expenses, PDF/share links, yearly reports. **Hiding them is a valid fix.** A smaller app that is always right beats a big one that is sometimes wrong, especially with the first Warangal merchants.

### Data honesty note

B22: `ram-kirana-jul9-real-sales.sql` inserted two sales via SQL, not tagged DEMO_SEED, with `source='voice'` set by hand, and `patch-sources.sql` rewrote demo source values to a target channel mix. Whatever the original reason, don't quote voice-usage or channel-mix numbers from that database to Dorm2VC or investors. Fresh usage metrics should come only from rows created through the app.

---

## 4. Feature status matrix (code-level; runtime pending U1)

| Feature | Status | Main blockers |
|---|---|---|
| Signup / login | PARTIAL | No forgot password; small tap targets |
| Onboarding + sample catalogs | PARTIAL | Restaurant/clothing unwired; GST placeholder |
| Import CSV/XLSX | BROKEN | Only 5 rows; xlsx vuln |
| Quick entry | PARTIAL | Balance race; UPI default; IST date |
| Full entry | PARTIAL | Expense/income unusable |
| Bill scan | PARTIAL | 15 to 26% truncation; money errors; matcher; quota |
| Ledger capture | PARTIAL | Wrong total; does not save |
| Voice sales | BROKEN in a real shop | VAD, hallucination, races, quota |
| Customers + udhaar | PARTIAL | Balance race; toggle bug; no add/edit customer |
| WhatsApp reminders/receipts | PARTIAL | Leading-0 phones |
| Din ka hisab | PARTIAL | UPI default; skipped days; float tally; no nav |
| Inventory | PARTIAL | Stock races; empty for new stores |
| Reports | PARTIAL | GST zero; 1000-row cap; fixed-cost math |
| Share links / cron reports | LIKELY BROKEN | Date column; never expire |
| AI advisor + insight | UNTESTED live | Quota; insight token budget (A-16) |
| Transactions history | PARTIAL | Void then delete; no edit |
| RLS / tenant isolation | LIKELY OK | Proof script not yet run |

---

## 5. Fix lanes and parallelism

Three lanes own disjoint files, so they can run in parallel in separate worktrees. Inside a lane, run one session at a time.

| Lane | Owns | Waves |
|---|---|---|
| **1: Money + DB** | `app/api/entry/*`, `app/api/scan/confirm`, `app/api/customers/[id]/payment`, `app/api/transactions/*`, `app/api/reconciliation`, `app/api/reports/*`, `app/api/cron/*`, `lib/inventory/*`, `lib/reports/*`, `lib/transactions/*`, `supabase/migrations/*`, `supabase/seeds/*`, new `lib/time/ist.ts` | W0-1 to W0-7, W1-1, W1-2 (non-voice files), W1-3, W2-1 to W2-5 |
| **2: AI pipelines** | `lib/anthropic/*`, `lib/voice/*`, `lib/scan/match.ts`, `lib/scan/resolve.ts`, `lib/scan/inferQtyPrice.ts`, `hooks/useVoiceSession.ts`, `app/(dashboard)/voice/page.tsx`, `app/api/scan/route.ts`, `app/api/voice/parse`, `app/api/ai/*`, `app/api/import/map`, `lib/ratelimit.ts`, `eval/*` | W0-8, W0-9, W1-4 to W1-10, W2-8, W2-9 |
| **3: UX + auth + import** | `app/(auth)/*`, `app/(dashboard)/settings`, `app/(dashboard)/customers`, `app/(dashboard)/scan/page.tsx`, `components/*` (except voice), `app/api/import/upload`, `app/api/import/confirm`, `app/api/stores/seed`, `app/privacy` | W0-10, W0-11, W1-11 to W1-15, W2-6, W2-7, W2-10 |

Conflict points to watch:
- `QuickEntry.tsx` (Lane 3 owns; Lane 1's UPI-default change goes there as a one-line edit after Lane 3 merges).
- Lane 1 adds the migration numbers. No other lane writes migrations.
- Merge one lane at a time into `main`; rerun `npx tsc --noEmit && npm test && npm run build` after each merge.

Lane 2 should run the eval harness before and after each change and paste the numbers into the commit message.

---

## 6. Prompts

### P0: Unblock and finish the audit (one session, after U1 to U3)

```
Read audit/AUDIT_REPORT.md and findings-A to D. The Supabase project is restored and a separate audit project exists (credentials in .env.audit). No em dashes.

1. Add "eval", "e2e", "audit" to tsconfig exclude. Confirm npx tsc --noEmit, npm test, npm run build pass. Commit audit/, eval/, e2e/ (respect .gitignore for private fixtures) to branch audit/results.
2. Against the AUDIT project only (refuse if the URL matches production): apply migrations in the order in section 2 U1, create the documents bucket, run audit/scripts/B-rls-proof.ts and B-balance-race-live.ts. Record results in audit/findings-B-live.md. Any LEAK row is P0; stop and tell me.
3. Run the Playwright journeys in e2e/ against the audit project on port 3001. Replace findings-D.md with runtime evidence and update the journey table.
4. Production checks (read-only, one audit-e- account): is prod on main's commit, which env vars exist on Vercel (names only), does GEMINI_MODEL resolve and have quota, are crons succeeding, RLS enabled on every prod table, PostHog sending PII. Write audit/findings-E.md.
5. Update the feature matrix and the Wave tables in AUDIT_REPORT.md with what changed. List any new P0.
```

### Lane 1: Money + DB (run sessions in this order)

```
Read audit/AUDIT_REPORT.md, findings-A and findings-B. You own only the Lane 1 files listed in section 5. Follow CLAUDE.md: failing test first, then fix, then npx tsc --noEmit, npm test, npm run build. No em dashes. Atomic commits referencing the W-IDs. Apply new migrations to the audit Supabase project first; give me the exact SQL to paste into production at the end.

Session 1 (W0-1, W0-4): Create migration 009 with Postgres functions that do each save in ONE transaction: record_sale / record_purchase (transaction + items + stock movements + inventory upsert with ON CONFLICT DO UPDATE SET current_stock = inventory.current_stock + EXCLUDED.current_stock + atomic balance increment), record_payment, void_transaction (conditional on voided_at IS NULL, returns nothing if already voided), delete_transaction. Fix the item_number trigger collision. Switch entry/quick, entry/full, scan/confirm, customers/[id]/payment and transactions/[id] to call them via supabase.rpc. Move audit/tests/B-balance-race.test.ts and B-integrity.test.ts into the main suite and make them pass; then run audit/scripts/B-balance-race-live.ts against the audit DB.

Session 2 (W0-2, W0-3, W0-5): set_payment adjusts balance when moving to or from credit and refuses voided rows; DELETE refuses or handles voided rows without double reversal; zod validation on every write route (type enum, positive finite quantity, credit requires customer, server-computed totals, customerId and documentUploadId verified against the store).

Session 3 (W0-6, W0-7): migration 010 with the missing document_uploads UPDATE and storage DELETE policies, RLS on kaggle_products (or drop it), CHECK constraints on type, source, payment_method. Rewrite every seed script to take an explicit store id variable and refuse if it is not set.

Session 4 (W1-1, W1-2, W1-3): lib/time/ist.ts with todayIST() and IST period bounds, used by every write and read path. Default payment method cash in the Lane 1 files; scan purchases honour the payment method sent. Reconcile carries forward through unclosed days and compares in integer paise.

Session 5 (Wave 2: W2-1 to W2-5): report totals via SQL aggregation RPCs, cron and share fixes, share link expiry and revoke, fixed cost math decision (ask me: monthly amount exactly, or daily x days), demo data excluded everywhere real usage is shown.
```

### Lane 2: AI pipelines

```
Read audit/AUDIT_REPORT.md and findings-C. You own only the Lane 2 files in section 5. Before any change, run the eval harness and record the baseline: npx tsx eval/run.ts --task scan --model $GEMINI_MODEL and --task voice. Rerun after each change and put before/after numbers in the commit message. Failing test first where the logic is deterministic. No em dashes.

Session 1 (W0-8, W0-9, W1-4): one Gemini wrapper in lib/anthropic/client.ts with timeout, retry with backoff on 429/503, a configurable fallback model chain, structured logging of status, model, finishReason, token usage on every failure. Use friendlyAIError in scan and voice. Set thinkingConfig to a small budget and raise maxOutputTokens for scan and voice; retry once on JSON parse failure. Rate-limit import/map, cap chat message count and size, log loudly when Upstash is missing. Add maxDuration for voice/parse and import/map in vercel.json.

Session 2 (W1-5, W1-6, W1-8): reconcile line sum against printed total and flag mismatches instead of saving; treat an uncircled number in a handwritten list as a price; strip the size number only when it appears inside the size token text. Matcher: weight base name above brand, break ties, never auto-accept "suggest" in voice (return as did-you-mean). Prompt keeps common Indian names instead of translating. Plain catalog names in the voice bias list. is_bill check that rejects blank or non-bill images. Speech gate before sending audio, and a prompt rule to return empty for unclear speech; close/next commands need a confirmation beep or TTS.

Session 3 (W1-7, W1-9, W1-10, voice page): adaptive VAD noise floor, 6 to 8 s max segment, 300 to 500 ms pre-roll; sequence-numbered segments applied in order, late results dropped after stop, khatam/agla wait for in-flight segments, clear only saved rows, idempotent start; MediaRecorder mime detection with audio/mp4 fallback; spoken "saved, N rupees" or "save failed"; default payment cash on the voice page. Add an on-screen RMS meter behind a ?debug=1 flag so I can tune in a real shop.

Session 4 (W2-8, W2-9): store a correction only when the merchant edited the field, include qty and price corrections; fix scan loading copy to the measured latency.
```

### Lane 3: UX + auth + import

```
Read audit/AUDIT_REPORT.md and findings-A and D. You own only the Lane 3 files in section 5. Failing test first where possible, Playwright specs in e2e/ for each journey you touch. No em dashes; every interactive element gets a lift class.

Session 1 (W0-10, W0-11, W1-15): import sends all parsed rows (server-side temp storage or full payload within the 4.5MB cap) and the result message is truthful; forgot password via Supabase resetPasswordForEmail with a reset page; dashboard page handles a null user.

Session 2 (W1-11 to W1-14): scan review defaults to Purchase when a vendor is extracted; all primary buttons and inputs at least 44px; Add customer and edit phone on /customers; normalise phones with a leading 0 or +91 spacing; wire restaurant and clothing seeds; create inventory rows (0 stock) for seeded and new products.

Session 3 (W2-6, W2-7, W2-10): rewrite /privacy to match actual data flows (Gemini free or paid tier, voice audio, advisor context, PostHog, share links), no training claims; replace xlsx 0.18.5 with SheetJS 0.20.x from their CDN or exceljs, with a parse timeout; import writes correct source, normalises type and payment values.

Session 4 (product trims, ask me first): hide GST summary, ledger capture, and full-entry expense mode behind a feature flag until they are correct.
```

### Wave 3

Run later, one session each: Next.js upgrade (alone, nothing else in flight), cleanup (dead code, branches, CLAUDE.md stack section), transaction edit, migration system consolidation.
