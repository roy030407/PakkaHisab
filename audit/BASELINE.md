# PakkaHisab Audit Baseline

Audit date: 2026-10-14. Scope: audit only, no application code changed.
Raw logs live next to this file in `audit/logs/`.

## 1. Environment

| Item | Value |
|---|---|
| Audited clone | `C:\dev\pakkahisab-audit` (fresh `git clone` of origin, outside OneDrive) |
| Original working copy | `C:\Users\harwa\OneDrive\Desktop\Roy\Projects\KhaataOnline` (INSIDE OneDrive, so NOT used; see note) |
| node | v22.20.0 |
| npm | 10.9.3 |
| OS | Windows 11 Home 10.0.26300 |
| HEAD | `50ea40135aac2e54abc38045638fff00d5ac4f31` "feat: flat-level demo history, Most Popular Items on dashboard/voice/scan" (Fri Jul 10 2026) |
| origin/main | same SHA as HEAD and as local main in the OneDrive copy (in sync) |
| Branches (remote) | main, slice-a-collections, voice-layer-1, voice-layer-3, voice-layer-4 |
| Branches (local in OneDrive copy only) | feat/phase-2-bill-scanning, feat/phase-3-inventory (never pushed) |

Note: the OneDrive copy has one untracked file, `supabase/seeds/ram-kirana-jul9-real-sales.sql`. It is not in the audited clone.
Note: the OneDrive copy also contains a file literally named `nul` at the repo root (a Windows reserved name, usually an accidental redirect). It is not tracked by git, but it can break OneDrive sync and some tools.

## 2. Install (`npm ci`)

- Result: success, 884 packages added, 2m 02s. `postinstall` ran `prisma generate` (Prisma Client 7.8.0 into `lib/generated/prisma`).
- No peer dependency errors, no ERESOLVE, no EBADENGINE.
- Deprecated packages (7 warnings):
  - `@humanwhocodes/config-array@0.13.0`, `@humanwhocodes/object-schema@2.0.3`, `rimraf@3.0.2`, `glob@7.2.3`, `glob@10.3.10`, `node-domexception@1.0.0`
  - `eslint@8.57.1` (no longer supported)
- `npm audit`: 39 vulnerabilities (2 low, 11 moderate, 24 high, 2 critical).
  - Direct dependencies flagged: `next` (critical, range 9.3.4-canary.0 to 16.3.0-preview.10; fix is a semver-major jump to 16.4.0), `eslint-config-next` (high), `postcss` (high, via next), `prisma` (high), `shadcn` (high), `xlsx` (high, NO fix available).
  - `xlsx@0.18.5` is used on the import path (`lib/parsers/excel.ts`, `/api/import/*`) which handles user-uploaded files. Known prototype pollution and ReDoS advisories. See finding in findings-A.md.
  - `shadcn` and `prisma` are CLIs sitting in `dependencies`, not `devDependencies`.

## 3. Documentation drift (CLAUDE.md and HANDOFF.md vs code)

| # | Doc says | Code says |
|---|---|---|
| 1 | CLAUDE.md: AI is Anthropic Claude (`claude-sonnet-4-20250514`), env `ANTHROPIC_API_KEY` | Google Gemini via `@google/genai`; env `GOOGLE_AI_API_KEY`, optional `GEMINI_MODEL` (`lib/anthropic/client.ts`). `ANTHROPIC_API_KEY` is never read. HANDOFF.md already says this. |
| 2 | CLAUDE.md: auth is email OTP / magic link, no passwords | Email + password (`signUp`, `signInWithPassword` in `app/(auth)/login` and `signup`). `app/api/auth/callback` still exists for the magic-link flow. |
| 3 | CLAUDE.md: "All DB writes via Prisma parameterised queries" | No app or lib code imports Prisma Client (only generated files reference it). All runtime access is the Supabase JS client. Prisma is used only for schema and `generate`. |
| 4 | CLAUDE.md: "Prisma used for migrations" | Prisma has 2 migrations; Supabase SQL has 8 migrations applied by hand in the SQL editor (HANDOFF.md line 35). Two migration systems, neither authoritative. |
| 5 | CLAUDE.md: DB schema lists 13 tables plus `kaggle_products` | `prisma/schema.prisma` has 15 models; `001_rls_policies.sql` header says "all 13 tenant-scoped tables"; code also uses `cash_reconciliations`, `fixed_cost_overrides`. `bill_examples` / `kaggle_examples` tables mentioned in the extraction spec do not appear in code. |
| 6 | CLAUDE.md lists `/lib/parsers/dates.ts`, `/lib/utils/fuzzy.ts`, `/lib/utils/formatting.ts`, `/hooks/*`, `/data/seeds/*.ts` | `lib/parsers/dates.ts`, `lib/utils/*` do not exist (only `lib/utils.ts`). Fuzzy matching lives in `lib/scan/match.ts`. |
| 7 | CLAUDE.md file tree has no `/ledger`, `/reconcile`, `/transactions`, `/voice`, `/share/[token]`, `/privacy`, `/terms`, `/api/voice`, `/api/reconciliation`, `/api/cron/*`, `/api/health`, `/api/activity`, `/api/transactions`, `/api/fixed-costs`, `/api/stores` | All exist in code. |
| 8 | CLAUDE.md "Auth: 5 req/min/IP" rate limit | `lib/ratelimit.ts` uses Upstash and is only applied to `/api/ai/chat`, `/api/ai/insight`, `/api/scan`, `/api/voice/parse`. Not applied to any auth path (auth is client-side to Supabase, so Supabase's own limits apply). Silently disabled when Upstash env is unset. |
| 9 | HANDOFF.md: "63 vitest tests" (line 19) and "110 vitest tests" (line 21) | 110 tests in 14 files. Line 19 is stale. |
| 10 | HANDOFF.md: voice-layer-4 "NOT merged to main" | `main` HEAD is "flat-level demo history ... voice" and contains `app/(dashboard)/voice` and `/api/voice/parse`, so voice appears merged. The remote voice-layer-* branches still exist. Verify before trusting HANDOFF "NEXT" section. |
| 11 | HANDOFF.md commit trailer `Co-Authored-By: Claude Opus 4.8` | Cosmetic; harness injects a different trailer. |
| 12 | CLAUDE.md and project rule: NO em dashes anywhere | Em dashes remain in `CLAUDE.md`, `.env.local.example`, `prisma/schema.prisma`, `supabase/migrations/001`, `003`, `004`. The earlier sweep covered only `app/ components/ lib/ types/`. |
| 13 | CLAUDE.md env list: 5 vars | Code reads 12 (see INVENTORY.md). `.env.local.example` documents most but is not named `.env.example` (the audit brief assumed `.env.example`). |

## 4. Database (task 4): BLOCKED, awaiting DIRECT_URL

Status: NOT RUN. `DIRECT_URL` is not set in the shell environment and no `.env.local` exists in the clean clone. I deliberately did not read the `.env.local` in the OneDrive copy because it most likely points at the real project, not the empty audit project.

Pre-flight findings that affect this step (from reading the SQL, nothing executed):

- Migrations 001 to 006 contain zero `CREATE TABLE`. They only `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, add policies, columns, and defaults. Only 007 and 008 create tables. Applying 001 to 008 to an EMPTY database will therefore fail at 001 (`relation "stores" does not exist`).
- The base tables come from Prisma: `prisma/migrations/20250609000000_init_full_schema` and `20260620_add_voided_at_to_transactions`. A correct from-scratch order is: prisma migrations, then supabase 001 to 008. This ordering is documented nowhere (finding in findings-E.md).
- `psql` is available at `C:\Program Files\PostgreSQL\17\bin\psql`.

Plan once DIRECT_URL is provided:
1. Run 001 to 008 verbatim against the empty DB and record every error (expect 001 to fail).
2. Reset, apply the 2 Prisma migrations, then 001 to 008, record errors.
3. `npx prisma db pull --print > audit/logs/pulled.prisma` (never overwrite `prisma/schema.prisma`), then diff.
4. Re-run step 6 (HTTP smoke) against the real audit Supabase URL and keys.

## 5. Baseline checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS, exit 0, no errors |
| `npm run lint` (`next lint`) | PASS, "No ESLint warnings or errors" |
| `npm test` (`vitest run`, v4.1.8) | PASS: 14 files, 110 passed, 0 failed, 0 skipped, 4.9s |
| `npm run build` with NO env | FAIL, exit 1. `/login` and `/signup` fail prerender: "@supabase/ssr: Your project's URL and API key are required". A clean clone cannot build without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `npm run build` with placeholder Supabase env | PASS, 57 static pages generated. |

Build warnings (placeholder-env build):
- `@supabase/supabase-js` uses `process.version`, "not supported in the Edge Runtime" (import trace via `@supabase/ssr` createServerClient / createBrowserClient, hits `middleware.ts`). Benign today, but it appears on every build.
- webpack PackFileCacheStrategy: serializing big strings (102 kiB and 243 kiB).

Largest routes by First Load JS (shared baseline 87.7 kB):

| Route | Page size | First Load JS |
|---|---|---|
| `/settings` | 6.74 kB | 290 kB |
| `/entry` | 15.8 kB | 185 kB |
| `/reports` | 8.8 kB | 184 kB |
| `/dashboard` | 5.2 kB | 180 kB |
| `/login`, `/signup` | 3.07 kB | 180 kB |
| `/scan` | 7.36 kB | 177 kB |
| `/voice` | 7.68 kB | 164 kB |
| `/products` | 4.71 kB | 163 kB |
| `/advisor` | 3.44 kB | 160 kB |
| Middleware | | 82.3 kB |

Observations:
- `/login` and `/signup` at 180 kB are heavy for auth screens on a slow-4G target (CLAUDE.md UX principle 10).
- `/settings` at 290 kB is the heaviest page by a wide margin.
- `/api/health` is built as a static page (marked static in the route table), so it reports `ok` from build time semantics rather than a live check, and does not touch the DB.
- `/`, `/privacy`, `/terms` render dynamically (server-rendered on demand) although they look static.

## 6. HTTP smoke (dev server, port 3000, no auth)

Caveat: run with PLACEHOLDER Supabase env (`https://placeholder.supabase.co`), so every route that needs a real backend is only tested for its unauthenticated behaviour. Re-run after step 4 with a real audit project. Full table in `audit/logs/curl.tsv`.

Summary:
- Public pages 200: `/`, `/login`, `/signup`, `/onboarding`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml`. `/nonexistent` gives 404.
- Dashboard pages (`/dashboard /scan /entry /inventory /products /customers /reports /advisor /settings /ledger /reconcile /transactions /voice`): all 307 to `/login`. Expected.
- Every API route returns 401 to an unauthenticated call on its supported methods and 405 on unsupported ones. PATCH, PUT and DELETE on `[id]` routes, `/api/stores` and `/api/customers`: 401 where implemented. No auth bypass found.
- Cron routes return 401 without the secret. Expected.
- `/api/health` 200 `{"status":"ok",...}`.
- `/api/reports/share` GET without a token returns 400 (public lookup, not 401). Expected for a share link, but verify it cannot enumerate tokens.

Findings from this step:
- **500** `GET /share/badtoken`: `Error: Your project's URL and Key are required to create a Supabase client!` thrown from `app/share/[token]/page.tsx:35` (service-role client with no `SUPABASE_SERVICE_ROLE_KEY`). Root cause is missing env, but the public share page crashes with a 500 instead of a friendly 404 when misconfigured. Re-test with real env.
- Dev log: `TypeError: Cannot read properties of null (reading 'id')` at `app/(dashboard)/dashboard/page.tsx:54` (`user!.id`). The page body runs before the layout's redirect guard resolves, so for an unauthenticated visit the page throws server-side and only then Next returns 307. User-facing result is correct (redirect) but it is noisy and indicates the auth guard lives only in the layout (matches CLAUDE.md "session guard here only"). Pages must not rely on layout for authorization; RLS is the real backstop.
- `/onboarding` returns 200 unauthenticated (it is in the `(auth)` group and has no server-side guard). Check that its API calls (`/api/stores`, `/api/stores/seed`) 401 correctly; they do.

## 7. Files in this audit folder

- `BASELINE.md` (this file)
- `INVENTORY.md`
- `findings-A.md` to `findings-E.md` (scaffolding, with pre-seeded findings from the baseline)
- `logs/` raw outputs
