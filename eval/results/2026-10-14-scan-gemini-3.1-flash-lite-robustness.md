# Eval: scan / gemini-3.1-flash-lite (robustness)

Provider: gemini. Generated 2026-10-14T18:49:45.378Z. Options: `{"delayMs":4500,"retries":0,"cache":true,"only":["X-nonbill-app-screenshot","X-blank-page","X-huge-photo"],"robustness":false,"corrections":null,"injectError":null}`

## Headline

| metric | value |
| --- | --- |
| fixtures | 3 |
| gtItems | 0 |
| predItems | 9 |
| itemPrecision | 0 |
| itemRecall | - |
| namePrecision | 0 |
| nameRecall | - |
| qtyAcc | - |
| qtyScored | 0 |
| priceAcc | - |
| priceScored | 0 |
| totalAcc | - |
| totalScored | 0 |
| cartValueAcc | - |
| cartValueScored | 0 |
| catalogAcc | - |
| catalogScored | 0 |
| jsonParseFailures | 0 |
| httpFailures | 0 |
| otherFailures | 0 |
| firstAttemptFailures | 0 |
| truncated | 0 |
| misroutedAsLedger | 0 |
| ambiguousAsked | 0 |
| latencyMsP50 | 5872 |
| latencyMsP95 | 17774 |
| promptTokensMean | 1624 |
| outputTokensMean | 570 |
| thoughtsTokensMean | - |
| totalTokensMean | 2193 |

## By tag

| tag | fixtures | gtItems | itemPrecision | itemRecall | nameRecall | qtyAcc | priceAcc | catalogAcc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| robustness | 3 | 0 | 0 | - | - | - | - | - |

## Failure causes (item level)

| cause | count |
| --- | --- |
| extra_item | 9 |

## Worst 10 cases

### X-nonbill-app-screenshot (f1: 0)

- extra item "unknown" (qty 1, price 0)
- extra item "unknown" (qty 0, price 0)

### X-blank-page (f1: 0)

- extra item "Binding" (qty 0, price 0)

### X-huge-photo (f1: 0)

- extra item "salt" (qty 1, price 30)
- extra item "wheat flour" (qty 1, price 58)
- extra item "butter" (qty 1, price 285)
- extra item "biscuits" (qty 2, price 25)
- extra item "detergent" (qty 1, price 235)
- extra item "soft drink" (qty 2, price 45)
