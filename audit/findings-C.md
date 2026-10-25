# Audit Session C: Scan and Voice pipelines

Session C, 2026-10-14/15. Scope: bill scan and voice pipelines, an eval harness (`eval/`), baseline numbers, robustness, and the voice client. No app code was changed. `audit/PLAN.md`, `INVENTORY.md` and `BASELINE.md` did not exist when this session started, so this report works from the session brief alone.

## Summary (most severe first)

| # | Sev | Finding | Evidence | Fix direction |
|---|---|---|---|---|
| C1 | **Critical** | **The whole AI layer runs on a free-tier quota of 20 requests/day**, shared by scan, voice (1 call per spoken phrase), chat, insight and import, because all of them use `DEFAULT_GEMINI_MODEL`. `gemini-flash-latest` = gemini-3.8-flash, which was also 503 "high demand" for 40+ min today. No retry, no fallback model. A single busy hour of voice exhausts the day. | 429 body: `generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash`; probes in Part 3. | Paid tier or a separate key per feature; a fallback chain (for example 3.8-flash -> 3-flash-preview -> 2.5-flash) with backoff on 503/429; a separate key for evals. |
| C2 | **Critical** | **Voice VAD probably never fires in a real shop.** Replaying the merchant's own shop audio through the app's VAD: 99.7% of frames are above the 0.015 threshold, so zero segments are sent in 84 s. | `audit/scripts/C-vad-sim.ts`, Part 5a. Needs phone confirmation (different mic path). | Adaptive noise floor + max segment length + pre-roll. |
| C3 | **Critical** (env) | The configured Supabase host `ydvbjofgtqvlipibxgqc.supabase.co` returns **NXDOMAIN** (both REST and Postgres). Either the project is paused or deleted, or DNS is broken here. If it's the project, the whole app is down; I could not check live corrections or usage data. | `nslookup`, `audit/scripts/C-db-corrections.mjs`. | Check the Supabase dashboard (paused projects can be restored). |
| C4 | High | **Bills fail outright from truncated JSON**: thinking tokens count toward `maxOutputTokens: 4096`. 26% of bills on 3-flash-preview, 15% on 2.5-flash, all 6-7 line printed/digital bills. | `finishReason: MAX_TOKENS`, Part 3. | `thinkingConfig` with a small budget, raise the cap, slim the per-number schema, retry once on parse failure. |
| C5 | High | **Money errors with no cross-check**: handwritten prices read as quantities, a qty of 1 dropped because it equals the "1kg" pack size, line totals saved as unit prices. ₹488 bill -> ₹6,006 cart; ₹718 -> ₹4,053; ₹20 -> ₹300. The model read the printed total correctly each time. | Part 3. | Reconcile line sum vs `total_amount`; when they disagree, prefer the bill's numbers as line amounts and flag. Treat an uncircled number on a list as a price. Only strip the size number when it is actually inside the size token's text. |
| C6 | High | **Catalog matcher auto-picks wrong products**: Tata Salt -> Toor Dal, Aashirvaad Atta -> Aashirvaad Pasta, Eggs -> Pepsi (voice, ₹540), "paanch" -> 5 x Atta (₹1,150). Voice also auto-accepts every weak "suggest" match. | `audit/scripts/C-match-probe.ts`, Part 3. | Weight `base` above `brand` in Fuse (or require base similarity), break ties, never auto-accept `suggest` in voice; return it as "did you mean". |
| C7 | High | **Voice hallucinates from silence and noise**: 2 s of silence -> "aur maggi dena" -> Maggi in the cart; babble adds "Maggi do packet"; the real clip "Ek Bikaji" -> "ho gaya" = **close command (saves and stops)**. | Part 4. | Energy/speech gate before sending, prompt rule "if no clear speech return empty", confirm destructive commands with a beep or TTS. |
| C8 | High | **Run-on speech drops 90% of items**: a 60 s clip returns only the first phrase (2/20), no error. | Part 4. | Max segment length (6-8 s) and a prompt that lists every phrase. |
| C9 | High | **Voice cart race conditions**: out-of-order segment results land after "khatam"; items spoken during a save are wiped by `setRows([])` and never saved; tapping "try again" after an error duplicates the session and leaks the mic. | Part 5b. | Sequence numbers, drop late results, clear only saved rows, make start idempotent. |
| C10 | High | **Errors are invisible**: scan and voice routes swallow every model error with no log (how the July 404 hid); scan shows the literal "extraction_failed" to merchants; voice swallows unparseable JSON as "nothing said". | Part 1 S1/S2/V1, Part 4 drills. | Log status/model/finishReason on every failure, map errors with `friendlyAIError`, alert on failure rate. |
| C11 | High | **Blank page -> hallucinated bill with high confidence.** | Part 4. | Ask the model for `is_bill`/empty items; reject when no items or no numbers. |
| C12 | Medium | Voice bias list is brand-prefixed ("Coca-Cola Thums Up 600ml"), the model echoes it, and the matcher cannot map it back, so the item becomes a new ₹0 product. | Part 3. | Send plain catalog names, or match the echoed name against the same strings. |
| C13 | Medium | Prompt over-translates Hindi item names to English ("Toor daal" -> "pigeon pea lentils"), causing catalog misses. | Part 3. | Keep the common Indian name; translate only when it's needed for matching. |
| C14 | Medium | "Handwriting corrections" are mostly auto-generated matcher output, not human edits, and never include qty/price. Helps catalog naming a little (0.64 -> 0.81, n = 8), doesn't help reading. | Part 4. | Store a correction only when the merchant actually edited the field; include qty/price fields. |
| C15 | Medium | Latency: scan p50 11-13 s, p95 26-35 s (loading copy says 5-15 s); voice route has no `maxDuration`. | Part 3. | Fix copy, set `maxDuration`, reduce thinking. |
| C16 | Medium | iPhone (the merchant's device per the screen recording): `MediaRecorder` with `audio/webm` may be unsupported on older iOS; TTS is English-only (`en-IN`) and ignores `preferred_language`; iOS may block async TTS. | Part 5. | Feature-detect mime type (`audio/mp4` fallback); localized speech strings. |
| C17 | Low | Ledger pages are flattened (one date, no party per row); "Upload file (PDF or image)" copy but PDFs are rejected; the 10 MB server check is above Vercel's 4.5 MB body cap. | Part 1. | - |

### Baseline accuracy (sibling models; flash-latest was unavailable, see Part 3)

| task | model | n | precision | recall | other |
|---|---|---|---|---|---|
| scan | gemini-3-flash-preview | 19 bills / 80 lines | 0.92 | 0.60 | qty 0.92, unit price 0.83, printed total 0.50, **cart value 0.38**, catalog 0.77, **JSON fail 26%**, p50 11.2 s |
| scan | gemini-2.5-flash | 13 bills / 66 lines | 0.90 | 0.71 | qty 0.96, price 0.89, total 0.75, cart value 0.57, catalog 0.68, JSON fail 15%, p50 13.5 s |
| voice | gemini-flash-lite-latest | 16 clips | 0.81 | 0.65 | WER 0.26, intent 0.94 (commands 5/5), cart product 0.77, real-shop recall 0.25, p50 1.7 s |

---

## Part 1. How the pipelines work, and where they fail silently

### 1a. Bill scan

```
[phone]  ScanUpload (camera / gallery / file input, accept image/*)
   |     app/(dashboard)/scan/page.tsx processFile()
   |       browser-image-compression: max 1280 px long side, max 1.5 MB, keeps format
   v
POST /api/scan (multipart "file")                         app/api/scan/route.ts
   |  auth -> scanRateLimit (Upstash, 10/min; no-op if Redis env missing)
   |  store lookup -> MIME allowlist (jpeg/png/webp) -> size <= 10 MB
   |  upload to Storage "documents" -> insert document_uploads (pending)
   v
extractBillData(supabase, storeId, base64, mime)          lib/anthropic/extraction.ts
   |  PROMPT: system instruction (READ only, Hindi name expansion, size_token vs
   |          number_tokens rules) + last 5 extraction_corrections rendered as
   |          "handwriting that looks like X usually means Y"
   |  MODEL:  Gemini DEFAULT_GEMINI_MODEL (= GEMINI_MODEL env, else gemini-flash-latest)
   |          inline image, responseMimeType JSON, maxOutputTokens 4096, no retry, no timeout
   |  PARSE:  strip ``` fences -> JSON.parse (throws on bad JSON) -> map to RawExtractedItem
   v
resolveItems(supabase, storeId, rawItems, 'purchase')      lib/scan/resolve.ts
   |  load active catalog + 30-day line-item frequency
   |  per item: matchItem (Fuse on size-stripped name+brand; <=0.35 strong,
   |            <=0.6 suggest, else unmatched; variant by exact size, else most
   |            frequent, else ask)                         lib/scan/match.ts
   |            drop the pack-size number from number_tokens
   |            inferQtyPrice (roles from the model, else currency/x markers,
   |            else +-15% of catalog price, else ask)      lib/scan/inferQtyPrice.ts
   v
duplicate check (same vendor + same total in 24 h) -> document_uploads = extracted
   v
JSON { extraction, duplicateWarning } -> ExtractionReview / LedgerReview
   v  merchant edits, POST /api/scan/confirm -> transaction + stock + corrections
```

Silent or near-silent failure points (scan):

| # | Where | What happens | Who notices |
|---|---|---|---|
| S1 | route.ts:140 `catch {}` | Every extraction error (model 404 / 429 / 503, bad JSON, missing key) is swallowed with no log line, the upload is deleted and the row marked `failed`. The cause is lost. This is exactly how the July `gemini-2.5-flash` 404 went unseen. | Nobody. No server log, no metric. |
| S2 | scan/page.tsx:101 | The client shows `data.error` verbatim, so the merchant reads the literal string **"extraction_failed"** under "Something went wrong". Violates UX rule 7 (no technical errors). | Merchant, confusingly. |
| S3 | extraction.ts:41 | The corrections query ignores `error`; on failure it silently scans without the store's corrections. | Nobody. |
| S4 | extraction.ts:105 | `JSON.parse` on output cut at `maxOutputTokens` (4096 including thinking tokens on 2.5+ models) throws, becoming S1. Long bills / ledger pages are the likeliest to hit it. | Nobody. |
| S5 | extraction.ts:112 | `Number(n.value) \|\| 0`: a number token the model returns as a string with a comma ("1,250") or "Rs 30" becomes **0** silently, then feeds qty/price inference. | Merchant sees qty 1 / price 0 or a catalog price. |
| S6 | extraction.ts:121 | `document_type` defaults to `single_bill`; a model mistake to `ledger_page` silently routes a normal bill to LedgerReview, where every row gets the bill's single date and no party (the prompt flattens ledger rows, so per-row date/party is never extracted at all). | Merchant, as a wrong screen. |
| S7 | resolve.ts:30-52 | Catalog and frequency queries ignore `error`; on failure the catalog is empty and **every** item becomes `unmatched` with no hint why. | Merchant sees "not in catalog" for everything. |
| S8 | resolve.ts:69-76 | Pack-size stripping: if the model puts a quantity into `size_token` ("Atta 5 kg @ 58/kg"), the 5 is removed from number tokens and qty silently becomes 1 or a catalog fill. See Part 3 numbers. | Only if the merchant checks qty. |
| S9 | inferQtyPrice.ts:47 | When the model labels both a quantity and a "price", the price is trusted as a **unit** price even when the column is the line amount (handwritten forms and many kirana bills only have an amount column). See Part 3. | Only if the merchant checks totals. |
| S10 | route.ts:152-168 | Duplicate check needs both vendor and total; handwritten lists have neither, so duplicates are never flagged for them. | Nobody. |
| S11 | Deployment | Vercel caps request bodies at 4.5 MB, below the route's 10 MB check, and no `maxDuration` is set for `/api/voice/parse`. If compression fails or is bypassed, the platform answers with an HTML 413/504 and `res.json()` throws, so the merchant sees the generic "Could not process the image". | Merchant, generic error. |
| S12 | ScanUpload.tsx:72 | The "Upload file (PDF or image)" button copy promises PDF, but the input only accepts jpeg/png/webp and the route rejects PDFs. | Merchant. |

### 1b. Voice

```
[phone]  /voice page: mic tap -> useVoiceSession.start()          hooks/useVoiceSession.ts
   |  getUserMedia({audio:true}) -> AudioContext + Analyser (fftSize 1024)
   |  every 50 ms: RMS of latest 1024 samples -> advanceVad()      lib/voice/vad.ts
   |     RMS >= 0.015 -> speaking (recorder starts NOW, no pre-roll)
   |     >= 300 ms speech and >= 900 ms of RMS < 0.015 -> finalize -> recorder.stop()
   |  MediaRecorder('audio/webm') blob; < 1200 bytes dropped; offline -> 'offline'
   v
POST /api/voice/parse (multipart "audio")                      app/api/voice/parse/route.ts
   |  auth -> aiRateLimit (20/min) -> store -> MIME allowlist -> <= 5 MB
   |  load catalog (selling price) + 30-day freq; top 50 names by freq = bias list
   v
parseVoiceAudio(base64, mime, catalogNames)                    lib/anthropic/voiceParse.ts
   |  PROMPT: Hinglish shopkeeper persona, command phrase table, Hindi name
   |          expansion, ek..das + dozen numbers, catalog bias list appended
   |  MODEL:  same DEFAULT_GEMINI_MODEL, inline audio, JSON mime, maxOutputTokens 1024
   |  PARSE:  JSON.parse in try/catch -> {} on failure -> normalizeVoiceParse
   v                                                             lib/voice/parseGemini.ts
items:   matchItem per spoken item -> buildPendingRow -> productId or "new:<name>"
command: attach_customer / customer_balance -> matchCustomer (Fuse 0.45)
   v
JSON VoiceParseResponse -> page onResult()
   |  items  -> addRowsToCart (merge by productId)
   |  command-> decideCommandAction: next=save, close=save+stop, read_balance=speak,
   |           remove_last, set_qty(last row)
   v
saveCart: POST /api/products for "new:" rows, then POST /api/entry/quick (sale, upi|credit)
speak(): speechSynthesis, lang en-IN, English strings only        lib/voice/speak.ts
```

Silent or near-silent failure points (voice):

| # | Where | What happens | Who notices |
|---|---|---|---|
| V1 | voiceParse.ts:86-91 | **Unparseable or empty model output is swallowed**: `parsed = {}` gives `{kind:'items', items:[]}`, the route returns 200, the page does nothing. A truncated JSON (output cap 1024 tokens includes thinking on 2.5+ models) or a refusal looks exactly like "nothing was said". | Nobody. The phrase just vanishes. |
| V2 | route.ts:101 | Model errors (404/429/503) are caught with no log, returned as 422 `voice_parse_failed`. | Merchant sees "Something went wrong. Tap the mic to try again." |
| V3 | parseGemini.ts:47 | Quantity that is not a finite positive number becomes **1** silently (e.g. the model returns "2.5 kg" as a string, or 0). | Merchant, if they read the qty. |
| V4 | route.ts:131 | `unit` is only used as a size token if it contains a digit; "kilo", "packet", "dozen" are dropped. "ek kilo cheeni" is qty 1 of whatever sugar variant matches; "dhai kilo atta" (2.5) becomes 2.5 packs of the 5 kg atta. | Merchant, via a wrong total. |
| V5 | buildCartRow.ts:32 | A `suggest` (weak, Fuse 0.35-0.6) match is **silently auto-accepted** as the product: `matchedProductId ?? candidates[0]`. A misheard word lands in the cart as some other real product at its price, not as a new: row. | Merchant only if they read every row. |
| V6 | route.ts:89-91 | Bias list = top 50 by 30-day frequency. A store with more than 50 products and no recent history gets an arbitrary 50 (DB order), so most of the catalog is never in the bias. | Nobody. |
| V7 | useVoiceSession.ts:53-57 | After `stop()`, an in-flight segment still calls `onResult` and then `setStatus('listening')`. Rows appear in a cart after the session ended, and the status says "Listening" with the mic off. | Merchant, confusingly. |
| V8 | useVoiceSession.ts:65 | `new MediaRecorder(stream, {mimeType:'audio/webm'})` throws on browsers without webm recording (older iOS Safari; the merchant's own recording shows iPhone Safari). The throw happens inside `setInterval(tick)`, so it is an uncaught error every 50 ms with status stuck on "Listening". | Merchant: "it listens but never does anything". |
| V9 | page.tsx:64-121 | Items that arrive while a save is in flight are wiped by `setRows([])` and never saved; the reported sale total includes them. Details in Part 5. | Nobody. |
| V10 | page.tsx `saveCart` | A second `agla` while saving returns early with no feedback; there is no spoken "saved" confirmation on success either. | Merchant must look at the screen. |

## Part 2. Eval harness

Built in `eval/` (see `eval/README.md`). Highlights:

- `npx tsx eval/run.ts --task scan|voice --model <name>` runs the app's own `extractBillData` + `resolveItems` (scan) and `parseVoiceAudio` + the route's `matchItem`/`buildPendingRow`/`matchCustomer` (voice). Prompts are imported, not copied. Only the client's `generateContent` method is wrapped.
- Fake in-memory Supabase feeds the kirana sample catalog (`data/seeds/kirana.ts`) and optional `extraction_corrections`.
- Free tier: sequential calls, `--delay`, retries with exponential backoff honouring `retryDelay`, response cache on disk keyed by model + full request, `--retries 0` to reproduce production exactly, `--inject-error <status>` for fault drills.
- Provider seam (`eval/lib/providers/types.ts`): a backend returns the app's `RawExtraction` or `VoiceParseResult`; scoring is shared, so Sarvam or an open-source model plugs in without touching scoring.
- Outputs `eval/results/<date>-<task>-<model>[-label].json` (every case, raw output, telemetry) and `.md` (headline, per-tag, causes, worst 10 with reasons).
- Fixtures: 20 real images from `testing/`, hand labelled, plus derived blur / low-res / dark and robustness images; 25 Hinglish TTS clips, noise/babble variants, 6 real clips cut from the merchant's shop video (private, gitignored, silver labels), a silent clip and a 60 s clip.
- Helper scripts: `audit/scripts/C-vad-sim.ts` (replays real audio through the app's VAD), `C-probe-models.mjs`, `C-list-models.mjs`, `C-db-corrections.mjs`.

## Part 3. Baseline numbers

### Why the baseline is not on gemini-flash-latest

I tried. `gemini-flash-latest` (which the API reports resolves to **gemini-3.8-flash**) returned `503 UNAVAILABLE "high demand"` on every attempt for about 40 minutes (all 3.5 to 3.8 flash models did), then flipped to `429 RESOURCE_EXHAUSTED`: **free tier, `limit: 20` requests per day per model per project**, retry in about 5.5 h. Running a 40-clip + 26-image eval on that model with this key would also eat the production app's entire daily budget (same key, same model, see C1). So I stopped those runs and measured on sibling models that have their own quota:

- scan: **gemini-3-flash-preview**, 19 real fixtures (P02 skipped as a crop of P01); plus **gemini-2.5-flash**, 13 fixtures (stopped by its own daily cap)
- voice: **gemini-flash-lite-latest** (3.5-flash-lite), 16 scored clips + 3 robustness clips
- corrections A/B + image robustness: **gemini-3.1-flash-lite**

When the key has quota again (or with a separate paid key), the real baseline is one command each and the cache makes reruns free:

```
npx tsx eval/run.ts --task scan  --model gemini-flash-latest --robustness
npx tsx eval/run.ts --task voice --model gemini-flash-latest --robustness
```

### Baseline accuracy table

Scan (items: strict = name + qty + unit price all right; results in `eval/results/2026-10-14-scan-*.json|md`):

| model | bills | item precision | item recall | qty acc | unit price acc | printed total acc | cart value acc | catalog acc | JSON failures | latency p50 / p95 | thinking tokens (mean) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gemini-3-flash-preview | 19 | 0.92 | **0.60** | 0.92 | 0.83 | 0.50 | **0.38** | 0.77 | **5 / 19 (26%)** | 11.2 s / 34.6 s | 2,044 |
| gemini-2.5-flash | 13 | 0.90 | 0.71 | 0.96 | 0.89 | 0.75 | 0.57 | 0.68 | 2 / 13 (15%) | 13.5 s / 26.0 s | 1,713 |
| gemini-3.1-flash-lite (handwritten only) | 8 | 0.85 | 0.85 | 0.89 | - | - | - | 0.64 | 0 / 8 | 11.3 s / 93.2 s | - |

"Cart value acc" = share of bills where the sum of qty x price that would be saved equals the bill. Price accuracy is over bills that show a price (most handwritten lists show none).

Voice (gemini-flash-lite-latest, `eval/results/2026-10-14-voice-*`):

| clips | corpus WER | intent acc | commands | item precision | item recall | cart row -> right product | swallowed JSON failures | latency p50 / p95 |
|---|---|---|---|---|---|---|---|---|
| 16 (11 items, 5 commands; 9 clean TTS, 2 noisy TTS, 3 real shop, 2 code-mixed) | 0.26 | 0.94 | 5 / 5 | 0.81 | 0.65 | 0.77 | 0 | 1.7 s / 2.2 s |

Caveats: TTS speech is clean and read deliberately, so treat TTS rows as an upper bound. Real-shop labels are silver. Commands C08-C11 have no audio (TTS quota ran out). Blur / low-res / dark scan variants (B01-B03) exist but were not run, to stay inside quota.

### Failures grouped by cause

| cause | evidence | impact |
|---|---|---|
| **Truncated JSON (thinking eats the output budget)** | 5/19 bills on 3-flash-preview, 2/13 on 2.5-flash, every one `finishReason: MAX_TOKENS`. D03 on 2.5-flash: 2,955 thinking + 1,127 output tokens = cap 4,096. Hits the printed/digital bills with 6-7 lines, the bills the app should find easiest. | Whole bill fails as "extraction_failed". Dominates recall: digital recall 0.24, Devanagari 0 on 3-flash-preview are almost entirely truncation, not reading errors. |
| **Qty vs price on handwritten lists** | H09 "Vaseline - 80, Atta - 230, Yippee - 28, Rin - 150, total 488": 80 and 28 read as quantities, priced from the catalog: **cart ₹6,006 for a ₹488 bill**. H10 "Water - 20": 20 bottles x ₹15 = ₹300. P01 (2.5-flash): the "1" qty was dropped because it equals the "1kg" pack size, 30 then read as a qty against the wrong product's price: **₹4,053 for a ₹718 bill**. | Largest money errors. The model read the total (488 / 718) correctly every time, and nothing compares line sum vs printed total. |
| **Line total used as unit price** | P02: Parle-G "2 ... 20" saved as 2 x ₹20, Thums Up 2 x ₹90 (the Ganesh form only has an amount column). | Cart ₹828 vs ₹718. |
| **Catalog matcher (no AI involved)** | Reproduced with `audit/scripts/C-match-probe.ts` on the app's `matchItem`: "Tata Salt" -> **Toor Dal 1kg** (brand "Tata Sampann" outscores), "Aashirvaad Atta" -> **Aashirvaad Pasta**, "Maggi" ties Noodles vs Ketchup (0.008 each), "Parle-G Biscuits" -> nothing. Voice: "Eggs" -> **Pepsi 600ml x 12 (₹540)** via an auto-accepted weak match; a stray "paanch" -> 5 x Atta 5 kg (₹1,150). | Silent wrong product with the wrong price, shown as "matched". |
| **Prompt over-translates names** | "Toor daal" -> "pigeon pea lentils", "Aloo bhujia" -> "Potato snack", "Poha" -> "flattened rice", "Sooji" -> "semolina", all unmatched. Caused by "normalized_name: a clean English product name". | Catalog acc 0.64 on handwritten lists (3.1-flash-lite). |
| **Self-inflicted bias mismatch (voice)** | The route sends brand-prefixed bias names ("Coca-Cola Thums Up 600ml"); the model echoes them; `matchItem` cannot match that back to "Thums Up 600ml", so the row becomes a new ₹0 product. | Every brand-prefixed product spoken by voice is at risk. |
| **Hindi / Devanagari** | Printed Devanagari headers and labels (Ganesh form, "yog", "kul") were read fine where the JSON survived; failures on those bills were truncation and the amount-column semantics. | Not the bottleneck today. |
| **Abbreviations** | "Fortune Sun Oil" -> suggest only, "Kis. Jam" read correctly, "Chings schezwan" misread as "Chips schwen" / "Durgs schezwan" but still matched. | Recall 0.85 on abbreviations. |
| **Multi-column layouts** | Thermal Qty/Rate/Amount bills: 6/6 strict on P03 and P04 for both models. Problems only where the layout has a single amount column (P01/P02). | Fine when columns are labelled. |
| **Blurry images** | Not measured (B01-B03 ready to run). | - |
| **Noise (voice)** | Babble (N02): 1/3 items and a hallucinated "Maggi do packet" from the bias list. Real shop bed (N04): "Lays" lost. Real shop clips: "Ek Bikaji" -> "ho gaya" = **`close` command (would save and end the session)**; "Dairy Milk" -> empty transcript. | Real-shop item recall 0.25, intent 0.67. |
| **Code-mixed numbers** | "saade teen" 3.5, "dedh" 1.5, "dozen" 12, "pachees rupaye ka" 1 all right. "gyarah Maggi aur barah ande" -> "11 Maggi aur Barande" (eggs lost, "Barande" added as an item). "paanch Lays" -> "paanch" became its own item. | Numbers above 10 and number-then-short-brand are fragile. |

## Part 4. Robustness

| case | how tested | result | severity |
|---|---|---|---|
| Non-bill image (phone screenshot of the app) | scan, 3.1-flash-lite | 2 junk rows ("5-15", "16") from the loading-screen text, `single_bill`, confidence low. Would reach the review screen. | Medium |
| **Blank white page** | scan, 3.1-flash-lite | **Hallucinated a full bill**: vendor "OM SAI STATIONERY & PHOTOSTATE", total ₹100, item "Binding", **confidence high**. | High |
| ~9 MB photo (uncompressed, 4000 px) | scan, sent straight to `extractBillData` | Read correctly (6 items, total 785.40), 17.8 s, same image token count as the 1280 px version, so the extra bytes buy nothing. In production it never gets there: Vercel rejects bodies over 4.5 MB with an HTML 413 before the route's 10 MB check, and the client shows "Could not process the image". Client compression to 1.5 MB normally prevents this. | Low |
| Empty audio (0 bytes) | voice | Gemini 400 INVALID_ARGUMENT, route 422. The client already drops blobs under 1,200 bytes, so only reachable by a direct API call. | Low |
| **2 s of silence** (1,446 bytes, passes the client's 1,200-byte filter) | voice | **Hallucinated "aur maggi dena" -> 1 x Maggi added to the cart.** Any VAD false trigger (cough, door, cooler) can add a phantom item. | High |
| **60 s run-on audio** (14 phrases back to back, gaps < 900 ms) | voice | **2 of 20 items returned** (only the first phrase), no error, latency 2.2 s. Matches what Part 5's VAD replay predicts at a busy counter. | High |
| Model 404 (`--model gemini-fake-model-404`) | scan + voice | Both app functions throw (no fallback model). Route: 422 `extraction_failed` / `voice_parse_failed`, **nothing logged**. Merchant sees the literal text "extraction_failed". This is the July incident, still undetectable. | High |
| 429 (injected) | scan + voice | Same path as 404: no retry, no backoff, no distinct message. `lib/anthropic/errors.ts#friendlyAIError` exists but scan and voice do not use it. | High |
| **Real 503 / 429 seen live today** | probes | `gemini-flash-latest` 503 "high demand" for 40+ min, then the daily cap (20/day). Production would have failed every scan and voice phrase in that window. | **Critical** |
| Corrections few-shot: is it used? | code + A/B on 8 handwritten lists | Wired end to end (confirm route writes rows, extraction reads the last 5). But what it stores is mostly **not** human corrections: `ExtractionReview` seeds each row's name with the matched catalog name, so every auto-match whose catalog name differs from the raw text ("TATA SALT 1KG" -> "Salt 1kg") is saved as a "handwriting correction" with no edit by anyone. Qty/price fixes, the most common real errors, are never stored. The prompt then says "handwriting that looks like 'TATA SALT 1KG' usually means 'Salt 1kg'". The live DB could not be checked (C3). | Medium |
| Corrections few-shot: does it help? | same 8 fixtures, with vs without the 5 rows the app really stores | Catalog acc 0.64 -> 0.81, name recall 0.96 -> 1.00, item P/R 0.85 -> 0.89, qty unchanged, +240 prompt tokens. Gain comes from the model copying catalog naming ("Sooji (Rava)"), not from better reading. It did not fix H09's qty-vs-price error. n = 8, one run each, nondeterministic: directionally positive, not significant. | - |


## Part 5. Voice client, by code reading (plus one replay of real shop audio)

### 5a. VAD thresholds (lib/voice/vad.ts, hooks/useVoiceSession.ts)

Shipped values: frame every 50 ms, RMS over the latest 1024 samples (about 21 ms at 48 kHz, so roughly 58% of the audio is never looked at), speech when RMS >= 0.015 (about -36.5 dBFS), finalize after >= 300 ms of speech and >= 900 ms with RMS < 0.015.

1. **Fixed absolute threshold, no noise-floor tracking (High, needs phone confirmation).** I replayed the merchant's own shop recording (vids/ 11.18.40 PM, 84 s) through the app's `advanceVad`/`computeRms` (`audit/scripts/C-vad-sim.ts`). Background level: median RMS 0.069 (-23 dBFS), p10 0.050. **99.7% of frames are above 0.015, so the VAD never sees silence, never finalizes, and sends nothing for the whole 84 s.** It stays silent at thresholds 0.03 and 0.05 too; only at 0.08 does it cut 11 segments (longest 16 s). Caveat: that audio came through WhatsApp video recording, not `getUserMedia` with Chrome's default noise suppression and AGC, so the real in-app level may be lower. That's why this is on the phone checklist and not marked confirmed. The fix direction is clear either way: track an adaptive noise floor (for example threshold = max(0.015, 2.5 x rolling p20 RMS)) and add a hard max segment length.
2. **No maximum segment length.** With continuous counter chatter the recorder runs until the merchant taps stop, and then the clip is discarded (`stoppedRef` short-circuits `onstop`). Even if it were sent: route cap 5 MB, Vercel body cap 4.5 MB, no `maxDuration` on the voice route. Add a 6-8 s hard cut.
3. **No pre-roll.** The recorder starts only after the first loud frame (up to 50 ms detection plus MediaRecorder start latency). Hinglish quantities come first and are short ("do", "ek", "teen"). Clipping the onset can turn "do Maggi" into "Maggi", and the parser then defaults qty to 1 (parseGemini.ts:47). Keep a 300-500 ms ring buffer, or run the recorder continuously and slice.
4. **900 ms silence to finalize.** Fine in a quiet room, too long at a rush counter where the next phrase starts within 500 ms, so phrases merge (see the 60 s case in Part 4). Too short for a shopkeeper who pauses mid-list ("do Maggi ... aur ek Parle-G") and so gets two segments, which is harmless because results merge into the cart.
5. `MIN_CLIP_BYTES = 1200` is fine as a junk filter; a 300 ms opus clip is about 5 KB.

### 5b. The "khatam" save-then-stop race (app/(dashboard)/voice/page.tsx)

`runCommand('close')` does `void saveCart()` then immediately `stopRef.current()`. `saveCart` snapshots the rows synchronously, so the save itself is not cancelled by `stop()`. The real problems are around it:

1. **Out-of-order segments (High).** Each VAD segment is posted independently (`send` is not serialized). Say "do Maggi" then "khatam" quickly: the shorter "khatam" request can return first. The cart is saved without Maggi and the session stops. Then the Maggi response lands: `send` only checks `stoppedRef` before the fetch, not after, so `onResult` still adds Maggi to the (now empty) cart and `setStatus('listening')` shows "Listening" with the mic off. The leftover row silently rides into the next customer's sale. Same for `agla`.
2. **Rows added during a save are wiped (High).** `saveCart` awaits product creation and `/api/entry/quick`, then calls `setRows([])`, which clears every row, including items spoken while the save was in flight. Those items are never saved and the tracked `saleTotal` (read from the live rows after the await) includes them, so analytics overstate the sale.
3. **Second command while saving is dropped (Medium).** `agla` during an in-flight save hits `if (... saving) return`. No queue, no speech, no toast.
4. **No spoken confirmation (Medium).** Nothing is spoken on a successful save or on a save error. With hands-free use the merchant only learns about a failure (shown in `saveError`) by looking. After `khatam` the session is already stopped, so an error banner appears on a page the merchant has walked away from.
5. **Retry tap duplicates the session (Medium).** One failed segment sets status `error`, the button turns back into "start", and the copy says "Tap the mic to try again". `start()` then runs on top of the live session: new stream, new AudioContext, new interval. `loopRef`/`streamRef` are overwritten, so the old interval and microphone are leaked (the mic indicator stays on after stop) and two loops advance the same `vadRef`, halving the effective silence window.

Suggested shape of the fix: give each segment a sequence number, apply results strictly in order, and drop any result that arrives after the session ended. Make `close`/`next` wait for in-flight segments, then save. Clear only the rows that were saved (filter by the snapshot) instead of `setRows([])`. Speak "saved, N rupees" or "save failed".

### 5c. TTS language (lib/voice/speak.ts)

- `utter.lang = 'en-IN'` is hard-coded and every spoken string is English ("Total 120 rupees.", "Customer not found.", "Ramesh owes 450 rupees."). `stores.preferred_language` (hi/te/ta/mr) is never consulted, unlike the advisor which honours it.
- No voice is chosen explicitly. If the device has no en-IN voice, the browser silently falls back to its default voice (often en-US), and Hindi customer names get mangled.
- `speechSynthesis.cancel()` directly followed by `speak()` is a known source of dropped utterances on Chrome Android.
- iOS Safari only speaks after a user gesture has unlocked speech synthesis. Here every utterance comes from an async network callback, so on iPhone the first "Total ..." may never play.
- The spoken total comes out of the phone speaker while the mic is live. If echo cancellation does not remove it, the VAD records the app's own "Total 120 rupees" and sends it to the parser, which may read it as an item or a `read_balance` command (a feedback loop).

### 5d. Checklist: only verifiable on a real phone in a real shop

Run each on the merchant's actual phone (the screen recording shows **iPhone Safari**; also try a mid-range Android Chrome), at the counter during a busy hour.

- [ ] Mic permission prompt appears; denying it shows "Mic blocked"; allowing it after a deny works without a reload.
- [ ] **iPhone:** does `new MediaRecorder(stream, {mimeType:'audio/webm'})` work on this iOS version? If not, the page sits on "Listening" forever (uncaught error every 50 ms). Check Safari's console via a Mac.
- [ ] **VAD in real noise:** with the shop at normal noise, say "do Maggi" and stop talking. Does a request go out within about 1-2 s? (Watch the Network tab via remote debugging, or add a temporary on-screen RMS meter.) Note the RMS of background noise vs speech.
- [ ] Same during a rush: two people talking, traffic, a fan/cooler running, TV/radio on.
- [ ] First word clipping: say "do Maggi" crisply after silence. Does the cart show qty 2 or 1?
- [ ] Rapid "do Maggi ... khatam" within 1 s: is Maggi in the saved sale or left behind in the cart?
- [ ] "agla" said while the previous save is still spinning (slow 4G): is anything lost?
- [ ] Network drop mid-session (airplane mode for 5 s, then back): status, recovery, and whether tapping the mic creates a second session (mic indicator stays on after stop?).
- [ ] TTS: does "kitna hua" speak aloud? Which voice (en-IN or en-US)? On iPhone, does the first utterance play at all?
- [ ] Echo: with the phone on the counter, does the spoken total get picked up by the mic and produce a phantom item or command?
- [ ] Phone screen locks or the merchant switches to WhatsApp mid-session and comes back: does the mic resume, and does the AudioContext come back from `suspended`?
- [ ] Battery and heat over a 30 min session (setInterval at 20 Hz plus a live AudioContext).
- [ ] Bluetooth earphone or a wired headset mic: does the VAD threshold still fire?
- [ ] Latency felt at the counter: time from end of phrase to the row appearing, on the shop's actual 4G or Wi-Fi.
- [ ] Scan on the same phone: camera capture (iOS HEIC to JPEG path), a crumpled thermal bill under the shop's tube light, and the "Uploading your bill... 5-15 seconds" copy vs the real wait (eval median below is above 15 s).
- [ ] Real merchant handwriting: one week of the khata pages and supplier chits the merchant actually gets, scanned and corrected, then added to `eval/fixtures/scan/` as ground truth (the fixture set here is synthetic or staged).
