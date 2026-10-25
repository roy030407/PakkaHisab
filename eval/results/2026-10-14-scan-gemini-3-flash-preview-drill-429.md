# Eval: scan / gemini-3-flash-preview (drill-429)

Provider: gemini. Generated 2026-10-14T18:38:13.444Z. Options: `{"delayMs":4500,"retries":0,"cache":false,"only":["P03-thermal"],"robustness":false,"corrections":null,"injectError":429}`

## Headline

| metric | value |
| --- | --- |
| fixtures | 1 |
| gtItems | 6 |
| predItems | 0 |
| itemPrecision | - |
| itemRecall | 0 |
| namePrecision | - |
| nameRecall | 0 |
| qtyAcc | - |
| qtyScored | 0 |
| priceAcc | - |
| priceScored | 0 |
| totalAcc | 0 |
| totalScored | 1 |
| cartValueAcc | 0 |
| cartValueScored | 1 |
| catalogAcc | - |
| catalogScored | 0 |
| jsonParseFailures | 0 |
| httpFailures | 1 |
| otherFailures | 0 |
| firstAttemptFailures | 0 |
| truncated | 0 |
| misroutedAsLedger | 0 |
| ambiguousAsked | 0 |
| latencyMsP50 | - |
| latencyMsP95 | - |
| promptTokensMean | - |
| outputTokensMean | - |
| thoughtsTokensMean | - |
| totalTokensMean | - |

## By tag

| tag | fixtures | gtItems | itemPrecision | itemRecall | nameRecall | qtyAcc | priceAcc | catalogAcc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gst | 1 | 6 | - | 0 | 0 | - | - | - |
| multi_column | 1 | 6 | - | 0 | 0 | - | - | - |
| printed | 1 | 6 | - | 0 | 0 | - | - | - |

## Failure causes (item level)

| cause | count |
| --- | --- |
| missing | 6 |
| extra_item | 0 |

## Worst 10 cases

### P03-thermal (f1: 0)

- http 429: {"error":{"code":429,"message":"eval-injected 429","status":"INJECTED"}}
