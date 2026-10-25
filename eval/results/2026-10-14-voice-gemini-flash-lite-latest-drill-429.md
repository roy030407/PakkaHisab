# Eval: voice / gemini-flash-lite-latest (drill-429)

Provider: gemini. Generated 2026-10-14T18:38:17.261Z. Options: `{"delayMs":4500,"retries":0,"cache":false,"only":["V01"],"robustness":false,"corrections":null,"injectError":429}`

## Headline

| metric | value |
| --- | --- |
| clips | 1 |
| corpusWer | 1 |
| meanWer | 1 |
| devanagariTranscripts | 0 |
| intentAcc | 0 |
| commandIntentAcc | - |
| itemsIntentAcc | 0 |
| itemPrecision | - |
| itemRecall | 0 |
| cartCatalogAcc | - |
| jsonFailuresSwallowed | 0 |
| httpFailures | 1 |
| firstAttemptFailures | 0 |
| truncated | 0 |
| latencyMsP50 | - |
| latencyMsP95 | - |
| promptTokensMean | - |
| outputTokensMean | - |
| thoughtsTokensMean | - |

## By tag

| tag | clips | intentAcc | itemPrecision | itemRecall | wer |
| --- | --- | --- | --- | --- | --- |
| hinglish_numbers | 1 | 0 | - | 0 | 1 |
| items | 1 | 0 | - | 0 | 1 |

## Worst 10 cases

### V01 (reference: "do Maggi aur ek Parle-G", transcript: "")

- http 429: {"error":{"code":429,"message":"eval-injected 429","status":"INJECTED"}}
- intent: expected items/-, got -/- args null
- "Maggi" not extracted
- "Parle-G" not extracted
