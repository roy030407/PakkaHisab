# Findings B: AI features (Gemini): bill scan, voice, advisor, insight, import mapping

Scope for session B: `/api/scan*`, `/api/voice/parse`, `/api/ai/*`, `/api/import/map`, `lib/anthropic/*` (Gemini despite the name), `lib/scan/*`, `lib/voice/*`, `/scan`, `/voice`, `/advisor`.
Needs a real `GOOGLE_AI_API_KEY`. Without it every item below stays UNTESTED.

## Finding B-01
- Area: Naming and docs: `lib/anthropic/` is Gemini; `scripts/diag-anthropic.mjs` is stale
- Severity: P3
- Status: WORKS (code), BROKEN (docs)
- Evidence: `lib/anthropic/client.ts` imports `@google/genai`; `@anthropic-ai/sdk@^0.103.0` is still a production dependency; `grep -rn "process.env.ANTHROPIC" .` returns nothing outside docs.
- Repro steps: `grep -rn "@anthropic-ai/sdk" app lib scripts`
- Suggested fix (do not implement): Remove the unused dependency or document why it stays; rename folder or add a README in it.
- Effort: S

## Finding B-02
- Area: Scan pipeline end to end (`/api/scan`, `/api/scan/confirm`, `lib/anthropic/extraction.ts`)
- Severity: P1 until proven otherwise
- Status: UNTESTED
- Evidence: Zero route tests. Pure helpers `lib/scan/{match,normalize,inferQtyPrice}` have tests.
- Repro steps: Run a printed bill, a handwritten bill, and a ledger page through scan; confirm; verify `transactions`, `transaction_items`, stock, and `document_uploads.raw_extraction_json`. Test duplicate warning (same vendor and amount within 24h). Test Gemini error, timeout, and quota exceeded (route has `maxDuration` 60 in `vercel.json`).
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding B-03
- Area: Voice parse (`/api/voice/parse`, `lib/anthropic/voiceParse.ts`, `lib/voice/*`)
- Severity: P1 until proven otherwise
- Status: UNTESTED
- Evidence: HANDOFF.md says voice was "NOT yet device-tested" and "NOT merged to main", yet `main` contains `/voice` and `/api/voice/parse`. 110 unit tests cover pure logic only.
- Repro steps: Desktop browser with mic: speak Hinglish items, a command ("aakhri hata do"), mic denied, offline. Check the route with oversized or non-audio payloads.
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding B-04
- Area: Advisor chat and insight (`/api/ai/chat`, `/api/ai/insight`, `lib/anthropic/advisor.ts`)
- Severity: P2 until proven otherwise
- Status: UNTESTED
- Evidence: Context is built from `customers`, `fixed_costs`, `inventory`, `transactions`. HANDOFF.md warns against any "not used for training" claim on the free Gemini tier (privacy page may make such a claim).
- Repro steps: Ask the five example questions from CLAUDE.md 5a; check that answers use the right store's data only; read `app/privacy/page.tsx` for claims about AI data use.
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding B-05
- Area: Model pinning (`lib/anthropic/client.ts`)
- Severity: P2
- Status: PARTIAL
- Evidence: Comment says the default tracks Google's "latest" flash alias so a retirement does not break the app (commit b7f471e "retired Gemini model"). A moving alias means extraction output can change without a deploy.
- Repro steps: Read `lib/anthropic/client.ts`; run the same bill twice a week apart; compare JSON.
- Suggested fix (do not implement): Pin a model id per environment, add a small golden-bill regression set.
- Effort: M

## Finding B-06
- Area: Import AI mapping (`/api/import/map`)
- Severity: P2 until proven otherwise
- Status: UNTESTED
- Evidence: Route calls Gemini and has no ratelimit import (`grep ratelimit app/api/import/map/route.ts` is empty).
- Repro steps: Upload files with hostile cell contents (prompt injection text in headers) and confirm the mapping response is schema-validated before use.
- Suggested fix (do not implement): n/a until tested.
- Effort: S
