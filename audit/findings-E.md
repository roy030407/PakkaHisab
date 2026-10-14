# Findings E: Platform, database, build, docs, tooling

Scope for session E: migrations and schema drift, build and CI, env handling, health check, docs accuracy, repo hygiene, performance budget.

## Finding E-01
- Area: Database bootstrap order
- Severity: P1 (cannot stand up a fresh environment from the repo as documented)
- Status: BROKEN (by reading; execution blocked on DIRECT_URL)
- Evidence: `grep -ciE "create table" supabase/migrations/*.sql` gives 0 for 001 to 006 and 1 each for 007 and 008. 001 starts with `ALTER TABLE stores ENABLE ROW LEVEL SECURITY` and assumes tables exist. Base tables come from `prisma/migrations/20250609000000_init_full_schema`. HANDOFF.md line 35: migrations are "applied by hand".
- Repro steps: Empty Supabase project, `psql "$DIRECT_URL" -f supabase/migrations/001_rls_policies.sql`; expected `relation "stores" does not exist`.
- Suggested fix (do not implement): One authoritative migration chain (either Prisma migrate then Supabase SQL in a documented script, or all SQL under `supabase/migrations`); add a bootstrap script and a CI job that builds a fresh DB.
- Effort: M

## Finding E-02
- Area: Schema drift (`prisma/schema.prisma` vs live DB vs SQL migrations)
- Severity: P2
- Status: UNTESTED
- Evidence: schema comment mentions a prior drift fix (`PeriodicReport` unique key). Prisma has 15 models; `.from(...)` calls reference tables listed in `audit/logs/deps-by-file.tsv`.
- Repro steps: After bootstrap, `npx prisma db pull --print > audit/logs/pulled.prisma` and diff against `prisma/schema.prisma`; list every table and column used by `.from(...)` and `.select(...)` and verify it exists.
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding E-03
- Area: Build on a clean clone
- Severity: P2
- Status: BROKEN (without env), WORKS (with placeholders)
- Evidence: `npm run build` with no env: exit 1, `Error occurred prerendering page "/login"` and `"/signup"`: `@supabase/ssr: Your project's URL and API key are required to create a Supabase client!` (`audit/logs/build-noenv.log`). With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set: exit 0.
- Repro steps: Fresh clone, `npm ci`, `npm run build`.
- Suggested fix (do not implement): Create the browser client lazily inside handlers, or mark `/login` and `/signup` dynamic; document required build-time env in README; add a CI build with placeholders.
- Effort: S

## Finding E-04
- Area: Health endpoint (`app/api/health/route.ts`)
- Severity: P2
- Status: PARTIAL
- Evidence: Build route table shows static for `/api/health`. Response is `{"status":"ok","timestamp":...}` and checks nothing (no DB, no Gemini, no env).
- Repro steps: `curl http://localhost:3000/api/health` with Supabase down or env unset; still 200.
- Suggested fix (do not implement): `export const dynamic = "force-dynamic"`, check a cheap DB query and required env presence, split liveness from readiness.
- Effort: S

## Finding E-05
- Area: Documentation drift
- Severity: P2
- Status: BROKEN
- Evidence: 13 mismatches recorded in `audit/BASELINE.md` section 3 (Anthropic vs Gemini, OTP vs password, Prisma runtime claim, file tree, test counts, voice merge status, env list).
- Repro steps: Read `audit/BASELINE.md` section 3.
- Suggested fix (do not implement): Rewrite CLAUDE.md top sections; keep HANDOFF.md short and dated; delete stale lines.
- Effort: M

## Finding E-06
- Area: Em dash rule violations
- Severity: P3
- Status: BROKEN
- Evidence: A grep for the em dash character over `CLAUDE.md .env.local.example prisma supabase` lists `CLAUDE.md`, `.env.local.example`, `prisma/schema.prisma`, `supabase/migrations/001_rls_policies.sql`, `003_fix_share_rls.sql`, `004_id_defaults.sql`.
- Repro steps: Run `grep -rln` for the em dash character in the clone.
- Suggested fix (do not implement): Re-run the sweep over the whole repo (not only `app/ components/ lib/ types/`) and add a lint or pre-commit check.
- Effort: S

## Finding E-07
- Area: Env template
- Severity: P3
- Status: PARTIAL
- Evidence: No `.env.example` exists (only `.env.local.example`). Missing from template: `GEMINI_MODEL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. Template documents `DATABASE_URL` which no code reads.
- Repro steps: Compare `grep -rn process.env` output against `.env.local.example` (see `audit/INVENTORY.md`).
- Suggested fix (do not implement): Add the three vars, rename or copy to `.env.example`, remove or explain `DATABASE_URL`.
- Effort: S

## Finding E-08
- Area: Two migration systems and unused ORM
- Severity: P2
- Status: PARTIAL
- Evidence: Prisma Client is generated on every `npm ci` (`postinstall`) but no application file imports it; all runtime access is Supabase JS. `prisma` and `shadcn` are in `dependencies`.
- Repro steps: `grep -rln "generated/prisma" app lib components --include=*.ts --include=*.tsx` returns nothing.
- Suggested fix (do not implement): Decide: drop Prisma runtime and keep schema docs, or adopt it for writes; move CLIs to devDependencies.
- Effort: M

## Finding E-09
- Area: Repo hygiene (original working copy)
- Severity: P3
- Status: PARTIAL
- Evidence: The working copy is under OneDrive. It contains a file named `nul` at the repo root (reserved Windows device name) and an untracked `supabase/seeds/ram-kirana-jul9-real-sales.sql` whose name suggests real sales data. Local-only branches `feat/phase-2-bill-scanning` and `feat/phase-3-inventory` were never pushed.
- Repro steps: `ls` and `git status` in the OneDrive copy; `git branch -a`.
- Suggested fix (do not implement): Work from a non-synced path; delete `nul`; confirm the "real-sales" seed contains no personal data before it is ever committed.
- Effort: S

## Finding E-10
- Area: Performance budget
- Severity: P3
- Status: PARTIAL
- Evidence: First Load JS: `/settings` 290 kB, `/entry` 185 kB, `/reports` 184 kB, `/dashboard` 180 kB, `/login` and `/signup` 180 kB (shared baseline 87.7 kB). Middleware 82.3 kB. CLAUDE.md UX principle 10 targets slow 4G on mid-range Android.
- Repro steps: `npm run build` and read the route table; Lighthouse mobile throttled on `/login` and `/entry`.
- Suggested fix (do not implement): Lazy-load charts and PDF code, drop unused icon imports, split settings tabs.
- Effort: M

## Finding E-11
- Area: Test coverage
- Severity: P2
- Status: PARTIAL
- Evidence: 14 test files, 110 tests, all pure `lib/` logic. Zero tests for the 43 API routes, the pages, middleware, or RLS. `npm test` exit 0.
- Repro steps: `find . -name "*.test.*" -not -path "./node_modules/*"`
- Suggested fix (do not implement): Add API integration tests against the fresh audit DB and an RLS cross-tenant test suite first.
- Effort: L
