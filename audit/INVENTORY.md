# PakkaHisab Inventory

Generated from the fresh clone at commit `50ea401`. "Has tests" means a vitest file directly covers the module. No page or API route has any test; the 14 test files cover only pure `lib/` logic.

"Gemini" = Google Gemini via `@google/genai` (folder is still `lib/anthropic/`). "svc-role" = uses `createSupabaseServiceClient` (bypasses RLS).

## Pages

| Route | Purpose | Depends on | Has tests |
|---|---|---|---|
| `/` | Marketing landing page | none | n |
| `/login` | Email + password login | Supabase Auth | n |
| `/signup` | Email + password signup | Supabase Auth | n |
| `/onboarding` | Store setup wizard plus sample store seed | `stores`, `/api/stores`, `/api/stores/seed` | n |
| `/dashboard` | Today snapshot cards, popular items, insight card | `stores`, `transactions`, `customers`, `inventory`, `fixed_costs`, Gemini (insight) | n |
| `/scan` | Bill scanner UI | `/api/scan*`, Supabase Storage | n |
| `/entry` | Quick and full manual transaction entry | `/api/entry/*`, `products`, `customers` | n |
| `/inventory` | Stock list, alerts, ordering suggestions | `/api/inventory*` | n |
| `/products` | Product catalog management | `/api/products*` | n |
| `/customers` | Customer list and ledgers | `/api/customers*` | n |
| `/reports` | Period reports, charts, tax summary, PDF/share | `/api/reports*` | n |
| `/advisor` | AI chat | `/api/ai/chat`, Gemini | n |
| `/settings` | Store config, tax, fixed costs, import, logout | `/api/stores`, `/api/fixed-costs`, `/api/import/*` | n |
| `/ledger` | Collections ledger (aging, reminders) | `customers`, `transactions` | n |
| `/reconcile` | Daily cash reconciliation | `/api/reconciliation` | n |
| `/transactions` | Transaction history, void/edit | `/api/transactions*` | n |
| `/voice` | Voice-first sales entry (mic, VAD, Gemini audio) | `/api/voice/parse`, Gemini, Web Audio | n |
| `/share/[token]` | Public read-only periodic report | `periodic_reports`, `stores`, svc-role | n |
| `/privacy`, `/terms` | Legal pages | none | n |
| `/robots.txt`, `/sitemap.xml` | SEO (`app/robots.ts`, `app/sitemap.ts`) | `NEXT_PUBLIC_APP_URL` | n |
| `app/(dashboard)/layout.tsx` | Session guard, shell | Supabase Auth, `stores` | n |
| `middleware.ts` | Refresh Supabase session cookie on every request | Supabase Auth | n |

## API routes

| Route | Purpose | Depends on | Has tests |
|---|---|---|---|
| `/api/activity` | Recent activity feed | `stores`, `transactions` | n |
| `/api/ai/chat` | Advisor chat (streaming) | `ai_conversations`, `stores`, Gemini, Upstash | n |
| `/api/ai/insight` | Daily proactive insight | `stores`, Gemini, Upstash | n |
| `/api/auth/callback` | Supabase code exchange (legacy magic link) | Supabase Auth | n |
| `/api/cron/weekly-report` | Generate weekly reports for all stores | `periodic_reports`, `stores`, svc-role, `CRON_SECRET` | n |
| `/api/cron/monthly-report` | Generate monthly reports | same as above | n |
| `/api/customers` | List and create customers | `customers`, `stores`, `transactions` | n |
| `/api/customers/[id]` | Customer get, update, delete | `customers`, `transactions` | n |
| `/api/customers/[id]/payment` | Record payment against credit balance | `customers`, `transactions` | n |
| `/api/dashboard` | Dashboard aggregates | `customers`, `fixed_costs`, `inventory`, `transactions` | n |
| `/api/entry/full` | Full-form transaction save | `transactions`, `transaction_items`, `products`, `customers` | n |
| `/api/entry/quick` | Quick +/- transaction save | same as above | n |
| `/api/fixed-costs` | List and create fixed costs | `fixed_costs`, `stores` | n |
| `/api/fixed-costs/[id]` | Update, delete, per-period override | `fixed_costs`, `fixed_cost_overrides` | n |
| `/api/health` | Liveness (static at build, no DB check) | none | n |
| `/api/import/upload` | Parse uploaded Excel/CSV | `xlsx` | n |
| `/api/import/map` | AI column mapping | Gemini | n |
| `/api/import/confirm` | Bulk import products/inventory | `products`, `inventory` | n |
| `/api/import/template` | Download import template | `products`, `inventory`, `fixed_costs` | n |
| `/api/inventory` | Stock levels and movements, adjustments | `inventory`, `products`, `stock_movements`, `transactions` | n |
| `/api/inventory/suggest` | Ordering suggestions | `inventory`, `products` | n |
| `/api/products` | List and create products | `products`, `stores` | n |
| `/api/products/[id]` | Update and delete product | `products` | n |
| `/api/products/frequent` | Frequently used products (7 days) | `products`, `transaction_items`, `transactions` | n |
| `/api/reconciliation` | Cash reconciliation CRUD | `cash_reconciliations`, `transactions` | n (logic in `lib/reports/cashReconciliation` is tested) |
| `/api/reports` | Build report JSON for a period | `transactions`, `transaction_items`, `fixed_costs` | n |
| `/api/reports/pdf` | Render report as PDF | `@react-pdf/renderer` | n |
| `/api/reports/share` | Create and resolve share tokens | `periodic_reports`, svc-role | n |
| `/api/scan` | Upload bill, Gemini Vision extraction, duplicate check | Storage `documents`, `document_uploads`, Gemini, Upstash | n |
| `/api/scan/confirm` | Save confirmed scan into transactions | `transactions`, `transaction_items`, `products`, `customers`, `document_uploads` | n |
| `/api/scan/correction` | Store a handwriting correction | `extraction_corrections` | n |
| `/api/stores` | Get, create, update store | `stores` | n |
| `/api/stores/seed` | Seed sample catalog for store type | `products`, `fixed_costs` | n |
| `/api/transactions` | List and create transactions | `transactions`, `transaction_items`, `customers` | n |
| `/api/transactions/[id]` | Get, edit, void transaction (reverses stock and balance) | `transactions`, `inventory`, `stock_movements`, `customers` | n (reverse logic tested) |
| `/api/transactions/last` | Most recent transaction (undo) | `transactions` | n |
| `/api/voice/parse` | Gemini audio to cart items or command | Gemini, `products`, `customers`, Upstash | n |

## lib modules

| Module | Purpose | Depends on | Has tests |
|---|---|---|---|
| `lib/anthropic/client.ts` | Gemini client factory, model selection | `@google/genai`, `GOOGLE_AI_API_KEY`, `GEMINI_MODEL` | n |
| `lib/anthropic/errors.ts` | Map AI errors to friendly messages | none | n |
| `lib/anthropic/extraction.ts` | Bill Vision extraction plus per-store few-shot | Gemini, `extraction_corrections` | n |
| `lib/anthropic/advisor.ts` | Build advisor chat context | Gemini, 4 tables | n |
| `lib/anthropic/insight.ts` | Daily insight generator | Gemini, `periodic_reports` | n |
| `lib/anthropic/prompts.ts` | System prompts | none | n |
| `lib/anthropic/voiceParse.ts` | Voice audio prompt and call | Gemini | n (parse side tested via `lib/voice/parseGemini.test.ts`) |
| `lib/analytics/posthog.ts` | PostHog init | `NEXT_PUBLIC_POSTHOG_KEY/HOST` | n |
| `lib/collections/aging.ts` | Receivable aging buckets | none | y |
| `lib/collections/reminder.ts` | Payment reminder text | none | y |
| `lib/inventory/consumption.ts` | Consumption rate and stockout days | `stock_movements` | n |
| `lib/inventory/suggestions.ts` | Ordering suggestion logic | `inventory`, `products` | n |
| `lib/inventory/updateStock.ts` | Apply stock change plus movement row | `inventory`, `stock_movements` | n |
| `lib/parsers/amounts.ts` | Indian amount normalizer | none | n |
| `lib/parsers/csv.ts` | CSV parser | none | n |
| `lib/parsers/excel.ts` | XLSX parser | `xlsx` (high-severity advisory) | n |
| `lib/ratelimit.ts` | Upstash limiter; disabled if env unset | `UPSTASH_REDIS_REST_*` | n |
| `lib/reports/buildReport.ts` | Report aggregation | `transactions`, `transaction_items`, `fixed_costs*` | n |
| `lib/reports/cashReconciliation.ts` | Cash position math | none | y |
| `lib/reports/generatePDF.ts` | PDF document | `@react-pdf/renderer` | n |
| `lib/reports/periods.ts` | Period boundaries | none | n |
| `lib/reports/profit.ts` | Net profit with fixed costs | none | n |
| `lib/reports/tax.ts` | GST CGST/SGST/IGST math | none | n |
| `lib/scan/inferQtyPrice.ts` | Infer qty and price from bill line | none | y |
| `lib/scan/match.ts` | Fuzzy product match (Fuse.js) | `fuse.js` | y |
| `lib/scan/normalize.ts` | Normalize names and amounts | none | y |
| `lib/scan/resolve.ts` | Resolve scan lines to products | `products`, `transactions` | n |
| `lib/share/receipt.ts` | WhatsApp receipt text | none | y |
| `lib/supabase/browser.ts` | Browser Supabase client | anon key | n |
| `lib/supabase/server.ts` | Server and service-role clients | anon and service keys | n |
| `lib/transactions/reverse.ts` | Reverse a transaction's effects | none | y |
| `lib/utils.ts` | `cn` helper | none | n |
| `lib/voice/buildCartRow.ts` | Build cart row from parsed item | none | y |
| `lib/voice/cart.ts` | Cart state logic | none | y |
| `lib/voice/command.ts` | Voice command decisions | none | y |
| `lib/voice/customer.ts` | Customer name resolution | none | y |
| `lib/voice/parseGemini.ts` | Validate Gemini voice JSON | none | y |
| `lib/voice/speak.ts` | Speech synthesis wrapper | Web Speech | n |
| `lib/voice/types.ts` | Types | none | n |
| `lib/voice/vad.ts` | Voice activity detection | Web Audio | y |
| `lib/generated/prisma/*` | Generated Prisma client, UNUSED at runtime | none | n/a |

Test files not mapped to a module above: none (14 files, 110 tests, all pure logic).

## Scripts and SQL

| File | Purpose |
|---|---|
| `scripts/apply-004.mjs` | Apply migration 004 by hand |
| `scripts/diag-anthropic.mjs` | Diagnostic for the old Anthropic integration (stale name) |
| `scripts/diag-db.mjs` | DB diagnostic |
| `scripts/seed-demo.ts` | Demo seed (`npm run seed:demo`), uses service role |
| `supabase/migrations/001..008` | RLS, share tokens, defaults, cash reconciliations, fixed cost overrides |
| `prisma/migrations/*` | 2 migrations (init schema, `voided_at`) |
| `supabase/seeds/*` | 9 SQL seed and patch files plus a CSV (`RESET-AND-RESEED*.sql` are destructive) |

## Environment variables read in code

| Variable | Read in | In `.env.local.example`? | In CLAUDE.md? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/*`, `middleware.ts`, `scripts/seed-demo.ts` | yes | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/*`, `middleware.ts` | yes | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/server.ts`, `scripts/seed-demo.ts` | yes | yes |
| `GOOGLE_AI_API_KEY` | `lib/anthropic/client.ts` | yes | NO (doc says `ANTHROPIC_API_KEY`) |
| `GEMINI_MODEL` | `lib/anthropic/client.ts` | NO | NO |
| `NEXT_PUBLIC_APP_URL` | `app/layout.tsx`, `robots.ts`, `sitemap.ts`, `api/reports/share` | yes | yes |
| `UPSTASH_REDIS_REST_URL` | `lib/ratelimit.ts` | yes | NO |
| `UPSTASH_REDIS_REST_TOKEN` | `lib/ratelimit.ts` | yes | NO |
| `CRON_SECRET` | `api/cron/*` | yes | NO |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | `app/layout.tsx` | yes | NO |
| `NEXT_PUBLIC_POSTHOG_KEY` | `lib/analytics/posthog.ts` | NO | NO |
| `NEXT_PUBLIC_POSTHOG_HOST` | `lib/analytics/posthog.ts` | NO | NO |
| `DIRECT_URL` | `prisma.config.ts` (via `process.env["DIRECT_URL"]`) | yes | NO |
| `DATABASE_URL` | documented only, not read by app code | yes | NO |
| `ANTHROPIC_API_KEY` | NOT read anywhere | no | yes (stale) |

Missing or undocumented in `.env.local.example`: `GEMINI_MODEL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. Stale in CLAUDE.md: `ANTHROPIC_API_KEY`. There is no file named `.env.example`; the template is `.env.local.example`. Build requires the two `NEXT_PUBLIC_SUPABASE_*` variables to be set.
