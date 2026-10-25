# Session D findings: end-to-end merchant journeys (Playwright, mobile-first)

Status: **DRAFT, runtime blocked.** The Supabase project in `.env.local` is unreachable, so journeys 1 to 12 cannot run yet. This file will be replaced with runtime evidence once the database is back.

## Summary

| # | Journey | Status | Evidence |
|---|---------|--------|----------|
| 1 | Signup / logout / login / wrong password / forgot password | BLOCKED | Supabase host NXDOMAIN. Code: no forgot-password path exists (see F-04) |
| 2 | Onboarding: 5 store types, fixed costs, GST, CSV/XLSX import | BLOCKED | Code: restaurant + clothing have no sample seed (F-05), GST is "coming soon" (F-09), import sends only 5 preview rows (F-02) |
| 3 | Quick + full entry, frequent strip, Cash/UPI toggle, WhatsApp link | BLOCKED | Code: F-03, F-10, F-11, F-12 |
| 4 | Scan: single, batch, badges, edit, add size, qty/price, duplicate, purchase, sale | BLOCKED | Code: F-06, F-15 |
| 5 | Ledger capture | BLOCKED | Code: F-07, F-08 |
| 6 | Voice: mic denied, fake audio stream, on-screen equivalents | BLOCKED | Spec ready with synthetic WAV |
| 7 | Customers + udhaar | BLOCKED | Code: F-13, F-14 |
| 8 | Din ka hisab | BLOCKED | Code: F-16 |
| 9 | Inventory | BLOCKED | Code: F-17, F-18 |
| 10 | Reports, PDF, share link | BLOCKED | Spec ready |
| 11 | Advisor | BLOCKED | Spec ready (mocked stream) |
| 12 | Transactions history, edit, delete | BLOCKED | Code: F-19 (no edit) |
| 13 | Privacy, terms, 404, error boundary | PARTIAL | Public pages + 404 WORK at runtime; error boundary needs a logged-in session (blocked) |

## Blocker

**B-1 (Critical, environment): Supabase project unreachable.**
`ydvbjofgtqvlipibxgqc.supabase.co` returns NXDOMAIN from local DNS, 8.8.8.8 and 1.1.1.1. The pooler (`aws-1-ap-northeast-2.pooler.supabase.com`) answers `tenant/user postgres.ydvbjofgtqvlipibxgqc not found`. That is the signature of a paused or deleted free-tier project. Every login, API route and page behind auth fails. Owner is restoring the project.

## Findings (severity-sorted)

Legend: **RUNTIME** = observed in the browser. **CODE** = found while reading the code to write the specs; the spec that proves it is written and will run when the DB is back.

| ID | Sev | Journey | Finding | Basis |
|----|-----|---------|---------|-------|
| F-01 | High | 3, 7 | Post-save "Cash" tap on a **credit** sale sets `payment_method=cash` via `PATCH set_payment` without touching `customers.current_balance`. Udhaar stays inflated, and a later Void computes its reversal from "cash" so it never comes back down. The toggle also shows **UPI** highlighted after a credit sale. `app/api/transactions/[id]/route.ts` set_payment branch; `components/shared/PaymentToggle.tsx` | CODE |
| F-02 | High | 2 | Import wizard says "Import N rows" but posts only `preview` (first 5 rows, `app/api/import/upload/route.ts` `rows.slice(0, 5)`). A 20-row product sheet imports 5, and the done message reports 5 as if complete. `app/(dashboard)/settings/page.tsx` handleConfirm | CODE |
| F-03 | High | 3, 6 | Primary-action tap targets are far below 44px: quick-entry +/- are 28px (`w-7 h-7`), full-entry +/- 24px, popular-items +/- 24px, scan qty steppers 28px | CODE |
| F-04 | High | 1 | No "Forgot password" link or reset flow anywhere (`app/(auth)/login/page.tsx`). A merchant who forgets a password is locked out | CODE |
| F-05 | Medium | 2 | Restaurant and Clothing are offered "Yes, load sample data" at onboarding, but `SEED_MAP` in `app/api/stores/seed/route.ts` only maps kirana, medical, pharmacy, hardware. The seed files `data/seeds/restaurant.ts` and `clothing.ts` exist but are not wired. Those merchants silently get an empty catalog | CODE |
| F-06 | Medium | 4 | Scan review defaults to **Sale** even for a supplier bill with an extracted vendor. One tap on Save decreases stock instead of increasing it. Batch mode resets to Sale on every bill | CODE |
| F-07 | Medium | 5 | Ledger day total sums `unitPrice` before `totalPrice` (`app/(dashboard)/ledger/page.tsx`), so "Chai patti 3 x 120" counts as ₹120 not ₹360 | CODE |
| F-08 | Medium | 5 | Ledger capture never saves anything; the only action is "Scan another page". There is no nav link to `/ledger` | CODE |
| F-09 | Medium | 2 | GST configuration (slabs, CGST+SGST vs IGST) is a "coming soon" placeholder in Settings; not in onboarding either | CODE |
| F-10 | Medium | 3 | Full entry: Expense/Income have no amount field; Save is disabled until a product is added, so rent or salary cannot be recorded in Full mode | CODE |
| F-11 | Low | 3 | Full entry renders the literal text `&#10003; Customer selected` (HTML entity in a JS string) | CODE |
| F-12 | Low | 3, 4, 8 | Dates default to the UTC date (`toISOString()`): full entry, scan review, reconciliation API. Between 00:00 and 05:30 IST these are yesterday | CODE |
| F-13 | Medium | 7 | No "Add customer" on `/customers`; customers can only be created inside a sale. No way to edit a customer's phone, although Remind tells the merchant to "Add a phone number" | CODE |
| F-14 | Low | 7 | Phone numbers written with a leading 0 (`09876543210`, very common) produce no WhatsApp link (`buildWhatsappUrl` accepts only 10 digits or 12 starting 91) | CODE |
| F-15 | Low | 4 | Scan upload button reads "Upload file (PDF or image)" but the input and `/api/scan` reject PDF | CODE |
| F-16 | Low | 8 | Din ka hisab has no date picker and no nav link; carry-forward can only be checked through the API | CODE |
| F-17 | Medium | 2, 9 | Seeded or newly added products have no inventory row until their first stock movement, so a new store's Stock page is empty and those items cannot be adjusted from it | CODE |
| F-18 | Low | 9 | Expiry dates can only be set through an inventory CSV import; no product or stock field | CODE |
| F-19 | Medium | 12 | No edit for a saved transaction (only Void on history and Delete in the customer ledger) | CODE |
| F-20 | Low | 13 | `/api/health` returns `{"status":"ok"}` while the database is unreachable | RUNTIME |
| F-21 | Low | 13 | Unknown `/api/*` routes return an HTML 404 page, not JSON | RUNTIME |
| F-22 | Low | all | Login/signup inputs and buttons are 32px tall; all 7 interactive elements on `/login` at 360px are under 44px | RUNTIME |
| F-23 | Low | 13 | `app/(dashboard)/dashboard/page.tsx:54` throws `TypeError: Cannot read properties of null (reading 'id')` on every logged-out hit (layout redirect and page render run concurrently; page uses `user!.id`) | RUNTIME (server log) |

## Lighthouse (mobile, simulated slow 4G, dev server)

Dev server numbers (unminified, on-demand compile; each route warmed once). Production will be faster; relative ordering still useful.

| Page | Perf | A11y | LCP | TTI | Over 3s |
|------|------|------|-----|-----|---------|
| `/` | 65 | 100 | 3.1s | 12.1s | LCP, TTI |
| `/login` | 70 | 95 | 1.7s | 16.5s | TTI |
| `/signup` | 70 | 96 | 1.7s | 16.5s | TTI |
| `/dashboard`, `/scan`, `/voice`, `/reports` | BLOCKED | | | | |

## Coverage notes

- Gemini is mocked at the browser network layer (the app's own `/api/scan`, `/api/voice/parse`, `/api/ai/chat`, `/api/ai/insight`, `/api/import/map`) with fixtures built from each test store's real product and customer ids. Saves after the AI step hit the real DB. The server code between Gemini and those responses (catalog matching in `resolveItems`, scan duplicate detection, voice catalog/customer matching) is not exercised.
- `audit/PLAN.md`, `INVENTORY.md` and `BASELINE.md` did not exist when this session started; worked from the brief.
- `eval/fixtures/voice` does not exist; a synthetic voiced-burst WAV is generated in `e2e/fixtures/voice/`.
