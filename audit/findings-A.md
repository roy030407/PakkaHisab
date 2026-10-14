# Findings A: Security, auth, access control, dependencies

Scope for session A: auth flows, middleware and layout guard, RLS on every table, service-role usage, share tokens, cron secret, rate limiting, upload validation, dependency advisories.
ID format: A-01, A-02, and so on. Pre-seeded entries come from the baseline run; sessions should verify, extend, or close them.

## Finding A-01
- Area: Dependencies, import path (`lib/parsers/excel.ts`, `app/api/import/upload/route.ts`)
- Severity: P1 (user-supplied file parsed by a library with a known high-severity advisory and no fix)
- Status: UNTESTED
- Evidence: `npm audit --json` in `C:\dev\pakkahisab-audit`: `xlsx` severity high, range `*`, `fixAvailable: false`. Installed `xlsx@0.18.5` (`package.json` dependencies).
- Repro steps: Upload a crafted .xlsx to `/api/import/upload` as an authenticated user; check for prototype pollution or ReDoS (CPU hang) and the effect on the serverless function.
- Suggested fix (do not implement): Replace `xlsx` with a maintained parser (for example `exceljs`, or the SheetJS CDN build that carries the patched version), cap upload size and row count server-side, parse inside a time-bounded worker.
- Effort: M

## Finding A-02
- Area: Dependencies, framework (`next@14.2.35`)
- Severity: P1
- Status: UNTESTED
- Evidence: `npm audit --json`: `next` critical, range `9.3.4-canary.0 - 16.3.0-preview.10`, fix is semver-major to 16.4.0. `postcss` high via next. 39 vulnerabilities total (2 low, 11 moderate, 24 high, 2 critical).
- Repro steps: `npm audit` and read each advisory; decide which are reachable in this app (App Router, Vercel, middleware use).
- Suggested fix (do not implement): Triage each advisory for reachability; plan a controlled Next 14.2.x patch bump first, then a major upgrade as a separate project. Move `prisma` and `shadcn` CLIs to devDependencies to shrink the production surface.
- Effort: L

## Finding A-03
- Area: Public share page (`app/share/[token]/page.tsx:35`)
- Severity: P2
- Status: BROKEN (under misconfigured env)
- Evidence: `curl -i http://localhost:3000/share/badtoken` returns 500. Dev log: `Error: Your project's URL and Key are required to create a Supabase client! at SharePage (./app/share/[token]/page.tsx:35:98)`. Triggered because `SUPABASE_SERVICE_ROLE_KEY` was unset.
- Repro steps: Start dev with only the two `NEXT_PUBLIC_SUPABASE_*` vars, GET `/share/anything`. Re-test with full env: an unknown token must return 404 not 500.
- Suggested fix (do not implement): Wrap client creation, return `notFound()` or a friendly error; confirm the page selects only the columns it needs and never returns another store's data.
- Effort: S

## Finding A-04
- Area: Dashboard auth guard (`app/(dashboard)/dashboard/page.tsx:54`)
- Severity: P3
- Status: PARTIAL
- Evidence: Dev log on unauthenticated `GET /dashboard`: `TypeError: Cannot read properties of null (reading 'id')` at `.eq("owner_id", user!.id)`; the client still gets 307 to `/login`.
- Repro steps: `curl -i http://localhost:3000/dashboard` with dev server running, read the server log.
- Suggested fix (do not implement): Do not use `user!` in pages; check every page and API for the same non-null assertion. Auth must not depend on layout ordering. Verify RLS is the real boundary for each table.
- Effort: S

## Finding A-05
- Area: Rate limiting (`lib/ratelimit.ts`)
- Severity: P2
- Status: PARTIAL
- Evidence: `grep -rn ratelimit app lib`: applied only to `/api/ai/chat`, `/api/ai/insight`, `/api/scan`, `/api/voice/parse`. CLAUDE.md requires "Auth: 5 req/min/IP". Limiter is disabled when `UPSTASH_REDIS_REST_*` is unset (`.env.local.example` says so).
- Repro steps: Hit `/api/ai/chat` more than the limit with and without Upstash env; confirm fail-open vs fail-closed. Check whether `/api/import/*`, `/api/reports/pdf`, `/api/stores/seed` (all expensive) are limited.
- Suggested fix (do not implement): Decide fail-open vs fail-closed for production; add limits to import and PDF routes; rely on Supabase auth rate limits for login and document that.
- Effort: M

## Finding A-06
- Area: RLS coverage (all tables)
- Severity: P0 until proven otherwise
- Status: UNTESTED
- Evidence: Not yet run. `supabase/migrations/001_rls_policies.sql` covers 13 tables; `cash_reconciliations` (007) and `fixed_cost_overrides` (008) are separate; `owner_id = auth.uid()::text` casts (001).
- Repro steps: On the audit DB, create two users and two stores; with user A's JWT try SELECT, INSERT, UPDATE, DELETE on every table against store B's rows, through PostgREST and through each API route. Also test storage bucket `documents` policies and the share-token read policy (003).
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding A-07
- Area: File upload validation (`app/api/scan/route.ts`, `app/api/import/upload/route.ts`)
- Severity: P1 until proven otherwise
- Status: UNTESTED
- Evidence: CLAUDE.md requires server-side MIME validation and a 10 MB cap.
- Repro steps: Upload a .html or .exe renamed to .jpg, an oversized file, a zero-byte file, and a path-traversal filename, to both routes; check the stored object path and content type.
- Suggested fix (do not implement): n/a until tested.
- Effort: S

## Finding A-08
- Area: Cron routes (`app/api/cron/*`)
- Severity: P1 until proven otherwise
- Status: PARTIAL
- Evidence: Unauthenticated GET returns 401 (see `audit/logs/curl.tsv`). Behaviour when `CRON_SECRET` is unset is unverified (must fail closed). Routes use the service-role client and loop all stores.
- Repro steps: Unset `CRON_SECRET`, call with no header and with `Authorization: Bearer undefined`; expect 401 in both.
- Suggested fix (do not implement): n/a until tested.
- Effort: S
