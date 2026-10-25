# Eval: scan / gemini-3.1-flash-lite (corr-auto)

Provider: gemini. Generated 2026-10-14T18:48:35.787Z. Options: `{"delayMs":5000,"retries":3,"cache":true,"only":["H01-rotated-list","H03-list-sizes-words","H04-circled-qty","H05-brands","H06-overwritten","H08-single","H09-prices-total","H11-hindi-mixed"],"robustness":false,"corrections":"eval/fixtures/scan/corrections-auto.json","injectError":null}`

## Headline

| metric | value |
| --- | --- |
| fixtures | 8 |
| gtItems | 27 |
| predItems | 27 |
| itemPrecision | 0.889 |
| itemRecall | 0.889 |
| namePrecision | 1 |
| nameRecall | 1 |
| qtyAcc | 0.889 |
| qtyScored | 27 |
| priceAcc | 0.250 |
| priceScored | 4 |
| totalAcc | 1 |
| totalScored | 1 |
| cartValueAcc | 0 |
| cartValueScored | 1 |
| catalogAcc | 0.808 |
| catalogScored | 26 |
| jsonParseFailures | 0 |
| httpFailures | 0 |
| otherFailures | 0 |
| firstAttemptFailures | 4 |
| truncated | 0 |
| misroutedAsLedger | 0 |
| ambiguousAsked | 1 |
| latencyMsP50 | 7578 |
| latencyMsP95 | 28982 |
| promptTokensMean | 1867 |
| outputTokensMean | 347 |
| thoughtsTokensMean | - |
| totalTokensMean | 2215 |

## By tag

| tag | fixtures | gtItems | itemPrecision | itemRecall | nameRecall | qtyAcc | priceAcc | catalogAcc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviations | 3 | 11 | 1 | 1 | 1 | 1 | - | 0.727 |
| circled_qty | 5 | 16 | 1 | 1 | 1 | 1 | - | 0.867 |
| handwriting | 8 | 27 | 0.889 | 0.889 | 1 | 0.889 | 0.250 | 0.808 |
| hindi_names | 2 | 8 | 1 | 1 | 1 | 1 | - | 0.857 |
| qty_vs_price | 1 | 4 | 0.250 | 0.250 | 1 | 0.250 | 0.250 | 0.750 |
| rotated | 1 | 3 | 1 | 1 | 1 | 1 | - | 1 |
| size_as_qty | 1 | 3 | 1 | 1 | 1 | 1 | - | 1 |

## Failure causes (item level)

| cause | count |
| --- | --- |
| catalog_no_auto_match | 4 |
| price_read_as_qty | 2 |
| price_from_catalog | 2 |
| catalog_false_match | 1 |
| qty_ambiguous_asked | 1 |
| price_missing | 1 |
| extra_item | 0 |

## Worst 10 cases

### H09-prices-total (f1: 0.250)

- price 80 read as quantity
- unit price 68 came from the catalog, bill says 80
- price 28 read as quantity
- unit price 12 came from the catalog, bill says 28
- qty left for the merchant (ambiguous), expected 1
- no unit price read (bill says 150)
- not auto-matched (unmatched), expected "Rin Powder 500g"

### H03-list-sizes-words (f1: 1)

- auto-matched to "Thums Up 600ml" but the bill item is not in the catalog
- not auto-matched (unmatched), expected "Besan 500g"

### H04-circled-qty (f1: 1)

- not auto-matched (unmatched), expected "Toor Dal 1kg"

### H06-overwritten (f1: 1)

- not auto-matched (unmatched), expected "Ariel Powder 500g"

### H01-rotated-list (f1: 1)

- no item-level errors (low score from extras or total only)

### H05-brands (f1: 1)

- no item-level errors (low score from extras or total only)

### H08-single (f1: 1)

- no item-level errors (low score from extras or total only)

### H11-hindi-mixed (f1: 1)

- no item-level errors (low score from extras or total only)
