# Findings D: Reports, dashboard, tax, fixed costs, reconciliation, PDF, share

Scope for session D: `/dashboard`, `/reports`, `/reconcile`, `/settings` (fixed costs and tax), `/api/dashboard`, `/api/reports*`, `/api/fixed-costs*`, `/api/reconciliation`, `/api/cron/*`, `lib/reports/*`.
Key invariant: dashboard, reports, and reconciliation must agree with each other for the same period and store.

## Finding D-01
- Area: Profit and tax math (`lib/reports/profit.ts`, `tax.ts`, `periods.ts`)
- Severity: P1 until proven otherwise (wrong money numbers)
- Status: UNTESTED
- Evidence: No test files for these three modules (`cashReconciliation` is tested). CLAUDE.md defines daily fixed cost as monthly / 30 and GST as CGST+SGST vs IGST.
- Repro steps: Hand-compute a week with known sales, purchases, one monthly rent, and mixed GST slabs; compare against `/api/reports` output. Check month lengths, leap day, and IST day boundaries (dashboard comments say IST).
- Suggested fix (do not implement): Add unit tests with hand-computed fixtures first.
- Effort: M

## Finding D-02
- Area: Dashboard vs report consistency (`/api/dashboard`, `/api/reports`, `lib/reports/buildReport.ts`)
- Severity: P1 until proven otherwise
- Status: UNTESTED
- Evidence: Two separate aggregation code paths (`app/api/dashboard/route.ts` and `lib/reports/buildReport.ts`) both read `transactions` and `fixed_costs`.
- Repro steps: Seed a known day; compare today's sales, purchases, and net profit on `/dashboard` against the daily report and `/reconcile`. Test voided transactions are excluded in all three.
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding D-03
- Area: Fixed cost overrides (migration 008, `/api/fixed-costs/[id]`)
- Severity: P2 until proven otherwise
- Status: UNTESTED
- Evidence: New table `fixed_cost_overrides` is read by `lib/reports/buildReport.ts`; there are no tests.
- Repro steps: Override a month's rent, view that month and adjacent months in reports; delete the parent cost.
- Suggested fix (do not implement): n/a until tested.
- Effort: S

## Finding D-04
- Area: Share links (`/api/reports/share`, `/share/[token]`, migrations 002 and 003)
- Severity: P1 until proven otherwise
- Status: PARTIAL
- Evidence: `GET /api/reports/share` with no params returns 400 unauthenticated. Token entropy, expiry, revocation, and whether a token exposes anything beyond the intended report are unverified. `periodic_reports` unique key is `(storeId, reportType)` (schema comment), so a new weekly report may overwrite the previous one and its token.
- Repro steps: Generate a share link, read the token format, try neighbouring tokens, try after regenerating, check what JSON/HTML is exposed.
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding D-05
- Area: PDF export (`/api/reports/pdf`, `lib/reports/generatePDF.ts`)
- Severity: P2 until proven otherwise
- Status: UNTESTED
- Evidence: `@react-pdf/renderer` on a 30 s function (`vercel.json`). Hindi, Telugu, Tamil, Marathi text needs fonts that cover the scripts.
- Repro steps: Generate a PDF for a store with `preferred_language` of each supported language and an item name in Devanagari; check for missing glyphs.
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding D-06
- Area: Cron report generation (`/api/cron/weekly-report`, `monthly-report`)
- Severity: P2 until proven otherwise
- Status: UNTESTED
- Evidence: `vercel.json` schedules `30 0 * * 1` and `30 0 1 * *` (UTC, so 06:00 IST), `maxDuration` 300. One request loops all stores sequentially.
- Repro steps: Call with the secret against a seeded DB of several stores; time it; simulate one store failing and check that the others still complete.
- Suggested fix (do not implement): n/a until tested.
- Effort: M
