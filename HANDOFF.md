# PakkaHisab - Session Handoff

> New session: read this first, then `CLAUDE.md` (project source of truth). This
> file is the "where we are / what's next" snapshot. Date of handoff: 2026-06-19.

---

## TL;DR - start here

- **PakkaHisab** = a mobile-first business app for Indian shopkeepers (kirana etc.):
  scan/voice/manual sales, customers + udhaar (credit) with WhatsApp reminders,
  WhatsApp receipts, end-of-day cash close, inventory, reports, AI advisor.
- It is **deployed and live** at `https://pakka-hisab.vercel.app` (Vercel builds
  from `main`). Repo: `https://github.com/roy030407/PakkaHisab`.
- It is **in a real merchant's hands** (Ram Kirana, a busy Jaipur kirana store) as
  an **OkCredit POC** (a judged builder program, weekly deliverables; current
  milestone = "V1 in merchant's hands").
- Everything below the line "Built & live" is **done, committed to `main`, pushed,
  and verified** (tsc + 63 vitest tests + production build all green).
- **Voice-first sales session: Layers 1 + 2 + 3 are BUILT** (tsc + 102 vitest
  tests + production build green; NOT yet device-tested, NOT merged to `main`).
  Layers 1+2 are on branch `voice-layer-1` (pushed); **Layer 3 is on branch
  `voice-layer-3` off it** (corrections: remove_last / set_qty). Layer 1 = core
  session; Layer 2 = commands (agla/next, khatam/close, balance read-aloud);
  Layer 3 = voice corrections (drop last row, set last row qty). **THE NEXT BUILD
  = Voice Layer 4** (udhaar by voice + balance-by-name). **Begin there** (see
  "Next").

---

## Environment & facts

- Stack: Next.js 14 (App Router, TS strict), Tailwind + shadcn/ui, Supabase
  (Postgres + RLS), Prisma (schema source of truth; migrations applied **by hand**
  in the Supabase SQL editor), Vercel.
- **AI = Google Gemini 2.5 Flash**, NOT Claude, despite the `lib/anthropic/`
  folder name. Client: `lib/anthropic/client.ts` (`getGeminiClient`,
  `DEFAULT_GEMINI_MODEL`). Used for bill Vision and (planned) voice audio. Free
  tier currently.
- **Auth = email + password** (`supabase.auth.signUp` / `signInWithPassword`),
  NOT OTP/magic-link (old docs say OTP - ignore them). For frictionless signup,
  Supabase "Confirm email" should be OFF.
- Branch: work directly on **`main`** (the user prefers it; commits + pushes have
  been authorized throughout). `main` is in sync with origin at the latest commit.
- **Commit style:** atomic, end messages with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. The CLAUDE.md "commit
  gate" (wait for "commit") has in practice been relaxed by the user - they say
  "commit"/"push" freely; still confirm before pushing if unsure.
- **Workflow (from CLAUDE.md):** brainstorm -> spec -> plan -> approve -> build with
  TDD; verify (`npx tsc --noEmit`, `npm test`, `npm run build`) before commit.
- **Style rules (enforced):** NO em dashes anywhere; every interactive element gets
  a hover lift (`.btn-lift`/`.row-lift`/`.card-lift`) + pointer cursor; every
  touched file keeps its file-comment block updated.

---

## NEXT: device-test Layers 1-3, merge, then Voice Layer 4

The merchant **explicitly asked** to log sales by speaking, mid-rush ("ek doodh, 1
bread, 5 Parle-G..."). This is validated, not inference.

- **Spec:** `docs/superpowers/specs/2026-06-19-voice-first-session-design.md`
- **Plans (done):**
  `docs/superpowers/plans/2026-06-19-voice-first-session-layer1.md`,
  `docs/superpowers/plans/2026-06-20-voice-first-session-layer2.md`,
  `docs/superpowers/plans/2026-06-20-voice-first-session-layer3.md`
- **Branch topology (all off `main`, so production is untouched):**
  `voice-layer-1` = Layers 1+2 (pushed, independently mergeable).
  `voice-layer-3` = Layers 1+2+3 stacked (branched off `voice-layer-1`; corrections
  on top). Each pushed branch gets its own Vercel **preview** deploy.
- **Outstanding before merge:**
  1. **Real-device manual test (the spec's required pass, NOT yet done)** on the
     preview URL: speak 5+ Hinglish items with shop noise, confirm cart + saved
     cash sale + stock; run every command ("agla", "khatam", "balance batao",
     "aakhri hata do", "teen kar do") and its on-screen equivalent; test mic-denied
     / offline. Tune `VAD_SILENCE_THRESHOLD` / `VAD_SILENCE_MS` in
     `lib/voice/vad.ts` on-device (the one thing tests cannot cover).
  2. **Merge to `main`.** Either merge `voice-layer-3` (ships Layers 1-3 together)
     or merge `voice-layer-1` first (Layers 1+2), then `voice-layer-3`. Merging to
     `main` auto-deploys to production.
- **Voice Layer 4 (the next build):** udhaar by voice - `attach_customer`
  ("Sharma ji udhaar" -> match the customer by name, attach + mark the cart credit)
  and balance-by-name ("Sharma ji ka kitna baaki" -> look up + TTS that customer's
  outstanding). `decideCommandAction` currently no-ops `attach_customer`; the Gemini
  prompt will need to emit it with `args.customerName`, and the save path will need
  a credit + customer-pick branch (reuse the customer match + credit logic the
  collections + scan-as-sale features already use).
- **Carry-over refinement (noted for Layer 4):** the Khatam / `close` path fires
  `saveCart()` then `stop()` without awaiting (cart is preserved on save failure, so
  no data loss, but consider awaiting a successful save before ending the session).
- **Honest risks (from the spec):** noisy shop + other voices can mis-parse;
  ~1-2s latency + free-tier rate limits; VAD tuning needs real-device work; needs
  internet (no offline voice).
- **How to begin:** read the spec + the Layer 1/2 plans, then
  `superpowers:writing-plans` for a Layer 3 TDD plan, approve, build (on the same
  `voice-layer-1` branch, or a fresh branch off it).

---

## Built & live (this is all DONE - context, not TODO)

All on `main`, pushed, verified. Recent commit order (newest first): perf
(charts/compression) -> batch upload -> parallelize save -> matching fixes -> scan
UX fixes -> ledger capture -> resilience -> Slice C -> Slice B -> Slice A.

- **Voice-first sales session (Layers 1 + 2) - on branch `voice-layer-1`
  (pushed, NOT merged to `main`, NOT device-tested):**
  - **Layer 1 (CORE):** `/voice` screen + `POST /api/voice/parse`. Tap mic ->
    speak Hinglish items -> VAD pause-segments each phrase -> Gemini audio
    (`lib/anthropic/voiceParse.ts`) returns transcript + items/command -> server
    matches to catalog (reuses `matchItem`, creates active products for misses)
    -> live cart -> Save as a cash sale (reuses `/api/entry/quick`). Browser mic
    loop in `hooks/useVoiceSession.ts`; mobile mic FAB + sidebar "Voice" item.
  - **Layer 2 (COMMANDS):** voice `agla/next` (save + keep selling),
    `khatam/close` (save + end session), `balance/hisab batao` (browser
    `SpeechSynthesis` reads the total aloud), each with an on-screen button
    equivalent (Save & agla, Khatam, speaker). Pure logic in `lib/voice/command.ts`;
    TTS wrapper in `lib/voice/speak.ts`; command dispatch wired in the `/voice`
    page via refs. NO server change (Layer 1 route already classifies commands).
  - **Layer 3 (CORRECTIONS) - on branch `voice-layer-3`:** voice `remove_last`
    ("aakhri hata do" / "galat") drops the last cart row; `set_qty` ("teen kar do"
    / "make it 3") sets the last row's quantity (number flows via `args.quantity`).
    Pure ops `removeLastRow` + `setLastRowQuantity` in `lib/voice/cart.ts`;
    `decideCommandAction` extended (5-field action + args); Gemini prompt in
    `lib/anthropic/voiceParse.ts` now classifies both. Button equivalents are the
    existing per-row trash / +/- in `VoiceCart`. NO new UI.
  - Pure logic unit-tested (`lib/voice/`: parseGemini, cart, buildCartRow, vad,
    command - **102 tests total**); browser shells are tsc/build-verified.
  - **Known limitation (intended):** unmatched spoken item -> active product at
    `selling_price 0`, so that line saves at ₹0 (cart shows "No price set").
  - **VAD thresholds in `lib/voice/vad.ts` need on-device tuning.**
- **Slice A - Collections (udhaar + WhatsApp):** `payment` transaction type
  (cash-in, not revenue), customers "Udhaar due" tab with aging, receive-payment
  sheet, one-tap WhatsApp reminders (`wa.me`, +91), editable reminder template
  (Settings). Migration 006 (`stores.reminder_template`).
- **Slice B - WhatsApp receipts + scan-as-sale:** `buildReceiptText` +
  `ShareReceiptButton` (wa.me or clipboard), share after manual sale + on ledger
  rows; scan can be saved as a **sale** (not just purchase) via a Purchase/Sale
  toggle + customer picker.
- **Slice C - Din ka hisab (cash reconciliation):** `/reconcile` screen,
  `computeCashPosition` helper, `cash_reconciliations` table (migration 007),
  GET/POST `/api/reconciliation` (server recompute, opening carries forward).
- **Ledger capture (`/ledger`):** the OkCredit POC week-one screen - photo of the
  paper khata -> parsed entries -> day total (view-only, reuses `/api/scan`).
- **Resilience:** `AppErrorBoundary` wraps the dashboard layout; `ErrorState`
  (with retry) on reconcile/customers/ledger; all save fetches guarded (no stuck
  spinner on flaky 4G); `ConfidenceBadge` on low/medium scan rows.
- **Scan fixes (from real-device testing) - all live:**
  - Sale-first default; date prefills today + native calendar picker.
  - Scroll fix (qty/price stepper never hidden behind the footer).
  - "Is 0 the quantity or price?" only asks for a real number + has a "Neither".
  - Add-as-new products are now `is_active=true` -> they MATCH the next scan and
    show in Stock/Products (`app/api/scan/confirm/route.ts`).
  - "+ Add new size" on variant rows.
  - Clearer per-store correction wording fed to Gemini.
  - **Batch multi-image gallery upload** (review queue, "Bill X of N").
  - Edit fixed costs in Settings (reuses the existing PATCH route).
- **Perf:** scan save parallelized (was ~40 sequential DB calls -> batch inserts +
  parallel stock); photos compress to 1280px/1.5MB; `/reports` first-load JS
  **222kB -> 112kB** (recharts lazy-loaded via `next/dynamic`).

---

## Key files map (for the next session)

- Scan read+match pipeline: `app/api/scan/route.ts`, `lib/anthropic/extraction.ts`
  (Gemini Vision prompt + per-store corrections), `lib/scan/match.ts` (Fuse.js,
  thresholds STRONG 0.35 / SUGGEST 0.6), `lib/scan/inferQtyPrice.ts`,
  `lib/scan/resolve.ts`. Matcher catalog query is **active products only**
  (`resolve.ts`).
- Scan UI: `app/(dashboard)/scan/page.tsx`, `components/scan/ScanUpload.tsx`
  (gallery multi-select; `onFileSelected(files: File[])`),
  `components/scan/ExtractionReview.tsx`, `components/scan/LedgerReview.tsx`.
- Save paths to reuse for voice: `app/api/entry/quick/route.ts` (quick sale shape),
  `lib/inventory/updateStock.ts`.
- Collections: `app/(dashboard)/customers/page.tsx`,
  `components/customers/*`, `lib/collections/*` (reminder, aging),
  `app/api/customers/[id]/payment/route.ts`.
- Reconcile: `app/(dashboard)/reconcile/page.tsx`, `lib/reports/cashReconciliation.ts`.
- Settings (fixed costs edit, reminder template, import wizard, sample templates):
  `app/(dashboard)/settings/page.tsx`.
- Specs/plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`.

---

## Open threads / backlog (not blocking, pick up anytime)

- **Run migrations 006 + 007** in the Supabase SQL editor if not already (reminder
  template + cash_reconciliations). User said 006/007 were run.
- **Demo data for the panel** (untracked, ready to use):
  `supabase/seeds/ram-kirana-demo.sql` (a labeled DEMO week of transactions +
  customers - NOT to present as real usage) and
  `supabase/seeds/ram-kirana-products.csv` (a tailored Ram Kirana catalog). Also
  the built-in Settings -> Sample Templates -> Kirana works for the catalog.
- **Privacy pre-launch:** replace `[CONTACT_PLACEHOLDER]` (grep `TODO(privacy)`);
  do NOT make any "data not used for training" claim while on Gemini's FREE tier
  (Google's free terms allow training) - upgrade to a no-train tier first.
- **Deferred from privacy work:** self-serve "Export my data" / "Delete my data"
  in Settings.
- **D2/D3 perf:** DONE. A deeper audit (other heavy bundles, DB indexes) could
  still be done but is low priority.
- **Variant linking (from scan B2):** "+ Add new size" currently creates a
  standalone product; proper parent-child `parent_product_id` linking is a
  small follow-up (needs plumbing through match -> resolve -> types).
- **Usage-metrics card** for the panel ("days used / bills scanned / est. time
  saved"): discussed, NOT built. The Reports trend graph is the current proxy.
  There is no built "days active / time saved" screen.
- **A "usage metrics" panel artifact** + a real recording of the merchant using
  `/ledger` (and now voice) are what the OkCredit panel wants.

---

## Gotchas / things that will bite you

- **OneDrive + `.next`:** the repo lives in a OneDrive-synced folder, which causes
  recurring transient `EINVAL ... readlink '.next/...'` build errors. Fix: `rm -rf
  .next && npm run build` (or pause OneDrive sync / move the repo out of OneDrive).
  tsc + tests are unaffected.
- **claude-mem plugin is disabled** (global settings) because its worker was
  spamming "unreachable" hook errors. Leave it off unless asked.
- **snake_case vs camelCase:** Supabase returns snake_case (`current_balance`,
  `selling_price`). Normalize at the fetch boundary; `₹NaN` = you read the wrong
  case (see CLAUDE.md "SESSION LEARNINGS").
- **Import wizard** only ingests the preview rows (not full large files) - use a
  SQL seed for bulk data.
- **REVIEW.md** is intentionally untracked - leave it.

---

## Suggested first message for the new session

"Read HANDOFF.md and CLAUDE.md. The next build is the Voice-first sales session -
its spec is at docs/superpowers/specs/2026-06-19-voice-first-session-design.md and
is approved. Produce a writing-plans TDD plan for Layer 1 (the core session: /voice
screen + mic + VAD auto-segment + POST /api/voice/parse with Gemini audio + live
cart + save), then stop for my approval before building."
