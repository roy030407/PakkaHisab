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
- **Voice-first sales session: Layers 1 + 2 + 3 + 4 are BUILT** (the full
  spec, CORE + all STRETCH; tsc + 110 vitest tests + production build green; NOT
  yet device-tested, NOT merged to `main`). Branch stack off `main`:
  `voice-layer-1` (L1+2), `voice-layer-3` (L1-3), **`voice-layer-4` (L1-4, latest,
  pushed)**. Layer 1 = core session; Layer 2 = commands (agla/next, khatam/close,
  balance read-aloud); Layer 3 = corrections (drop last row, set last row qty);
  Layer 4 = udhaar by voice (attach customer + credit sale) + balance-by-name.
  **No further voice layers planned** - next is the device test + merge. **Begin
  there** (see "Next").

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

## NEXT: device-test the full voice feature (Layers 1-4), then merge

The merchant **explicitly asked** to log sales by speaking, mid-rush ("ek doodh, 1
bread, 5 Parle-G..."). This is validated, not inference. **The voice feature is
now fully built (all 4 layers); only the device pass + merge remain.**

- **Spec:** `docs/superpowers/specs/2026-06-19-voice-first-session-design.md`
- **Plans (all done):** `docs/superpowers/plans/2026-06-19-voice-first-session-layer1.md`
  and `...-layer2.md`, `...-layer3.md`, `...-layer4.md`.
- **Branch topology (all off `main`, so production is untouched):**
  `voice-layer-1` = L1+2, `voice-layer-3` = L1-3 (off voice-layer-1),
  **`voice-layer-4` = L1-4 (off voice-layer-3, the complete feature, pushed)**.
  Each pushed branch gets its own Vercel **preview** deploy.
- **Outstanding before merge:**
  1. **Real-device manual test (the spec's required pass, NOT yet done)** on the
     `voice-layer-4` preview URL: speak 5+ Hinglish items with shop noise, confirm
     cart + saved sale + stock; run every command ("agla", "khatam", "balance
     batao", "aakhri hata do", "teen kar do", "<name> udhaar", "<name> ka kitna
     baaki") and its on-screen equivalent; include a duplicate-merge case (speak an
     item already in the cart, then "aakhri hata do"); test mic-denied / offline.
     Tune `VAD_SILENCE_THRESHOLD` / `VAD_SILENCE_MS` in `lib/voice/vad.ts`
     on-device (the one thing tests cannot cover).
  2. **Merge to `main`.** Merge `voice-layer-4` to ship Layers 1-4 together (or
     merge the earlier branches in order first). Merging to `main` auto-deploys to
     production.
- **Voice backlog (nice-to-have, not planned):** a manual on-screen customer
  picker on `/voice` (for when voice mis-hears a name); new-customer-by-voice;
  partial-payment by voice; Hinglish/Devanagari number read-aloud (TTS is English
  now).
- **Carry-over refinement:** the Khatam / `close` path fires `saveCart()` then
  `stop()` without awaiting (cart preserved on save failure, so no data loss, but
  consider awaiting a successful save before ending the session).
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
  - **Layer 4 (UDHAAR BY VOICE) - on branch `voice-layer-4`:** voice
    `attach_customer` ("Sharma ji udhaar") fuzzy-matches a store customer
    server-side, attaches a detachable chip, and saves that sale on CREDIT with
    `customerId` (reuses `/api/entry/quick`, which bumps the customer's balance);
    `customer_balance` ("Sharma ji ka kitna baaki") looks up + reads the
    outstanding aloud. Pure `matchCustomer` (Fuse) + `buildBalanceByNameSpeech` in
    `lib/voice/customer.ts`; customer lookup in `/api/voice/parse` (store-scoped);
    Gemini prompt classifies both (name in `args.customerName`). Limitation: only
    EXISTING customers match; no manual on-screen customer picker on `/voice`
    (misfire safety = visible chip + detach + cash default). NO new-customer or
    partial-payment by voice.
  - Pure logic unit-tested (`lib/voice/`: parseGemini, cart, buildCartRow, vad,
    command, customer - **110 tests total**); browser/route shells are
    tsc/build-verified.
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
