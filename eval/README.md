# PakkaHisab eval harness (scan + voice)

Measures the bill-scan and voice pipelines by running the **production code**, not a copy of it:

- scan: `lib/anthropic/extraction.ts#extractBillData` (prompt, config, JSON parsing) then `lib/scan/resolve.ts#resolveItems` (Fuse matching with STRONG 0.35 / SUGGEST 0.6, variant picking, qty/price inference) against the app's kirana sample catalog.
- voice: `lib/anthropic/voiceParse.ts#parseVoiceAudio` with the same catalog bias list the route builds, then the route's own `matchItem` + `buildPendingRow` and `matchCustomer`.

The app modules are imported as-is. A fake in-memory Supabase (`lib/fakeSupabase.ts`) feeds them the catalog and the store's `extraction_corrections`. The eval patches only the `generateContent` method on the app's Gemini client singleton (`lib/gateway.ts`) to add caching, pacing, retries, fault injection and telemetry.

## Run

```bash
# one-time fixture build (needs ffmpeg; any static build works)
FFMPEG=/path/to/ffmpeg npx tsx eval/fixtures/scan/prepare.ts
FFMPEG=/path/to/ffmpeg npx tsx eval/fixtures/voice/generate.ts

npx tsx eval/run.ts --task scan  --model gemini-flash-latest
npx tsx eval/run.ts --task voice --model gemini-flash-latest --robustness
```

Options: `--delay <ms>` (pause before each live call, default 4500), `--retries <n>` (default 4; `0` reproduces production, which never retries), `--no-cache`, `--only P01-ganesh,H09-prices-total`, `--robustness` (adds X-* fixtures), `--corrections eval/fixtures/scan/corrections.json` (scan few-shot corrections), `--inject-error 429`, `--label <suffix>`.

Outputs: `eval/results/<date>-<task>-<model>[-<label>].json` (every case, raw model output, resolved items, telemetry) and `.md` (headline metrics, per-tag table, failure causes, worst 10 cases with reasons).

## Free tier

**Use a separate API key for evals.** On the free tier each model allows only 20 requests per day per project, and the app itself uses `gemini-flash-latest`. Running the eval on that model with the production key spends the merchant's daily budget. A 429 whose `retryDelay` is minutes or hours (the daily cap) fails fast instead of waiting.

Calls are strictly sequential. Every live response is cached in `eval/cache/<task>/<sha256>.json` keyed on model + full request (image/audio bytes, prompt, config), so a rerun with unchanged code costs nothing and reproduces the same numbers. Change the prompt or the model and only the affected calls go live. 429/500/503 are retried with exponential backoff (honouring the API's `retryDelay`). `firstAttemptFailures` in the summary counts cases that production would have failed, since the app has no retry.

## Metrics

Scan, per item (ground truth in `fixtures/scan/fixtures.json`):
- strict match = name aligned after normalization AND qty exact AND unit price exact (qty/price are skipped where the bill shows none). Item precision = strict / predicted lines, recall = strict / true lines.
- qty accuracy, unit-price accuracy (aligned items only), printed total accuracy, cart value accuracy (sum of qty x price that would hit the books), catalog accuracy (auto-match to the right product, or correctly NOT auto-matching an item that is not in the catalog), JSON parse failures, latency, tokens.

Voice, per clip (`fixtures/voice/fixtures.json`): WER of the transcript, intent accuracy (kind + command + args + resolved customer), item precision/recall (name aligned AND qty acceptable), cart catalog accuracy, JSON failures that the app silently swallows, latency, tokens.

## Adding a backend

Implement `ScanProvider` or `VoiceProvider` from `lib/providers/types.ts` (return the app's `RawExtraction` / `VoiceParseResult`) and register it in `lib/providers/index.ts`. Scoring, matching and reporting are shared, so Sarvam, an Ollama-served VLM, or Whisper + a small LLM compare like for like:

```bash
npx tsx eval/run.ts --task voice --provider sarvam --model saarika-v2
```

## Fixtures

- Scan: 20 real images from `testing/` (4 printed, 4 digital, 12 handwritten), hand labelled, plus derived blur / low-res / dark variants and X-* robustness images (non-bill, blank page, ~9 MB photo).
- Voice: Hinglish phrases read by Gemini TTS (re-encoded to webm/opus like MediaRecorder), noise and babble variants, a silent clip and a 60 s run-on clip. Clips cut from the merchant's real shop recording live in `fixtures/voice/private/` (gitignored, never commit). Their labels are silver (from a Gemini transcript).
- Synthetic speech is cleaner than a real counter. Treat TTS numbers as an upper bound.
