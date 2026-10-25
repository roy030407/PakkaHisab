# Eval: scan / gemini-3.1-flash-lite (corr-none)

Provider: gemini. Generated 2026-10-14T18:44:39.501Z. Options: `{"delayMs":5000,"retries":3,"cache":true,"only":["H01-rotated-list","H03-list-sizes-words","H04-circled-qty","H05-brands","H06-overwritten","H08-single","H09-prices-total","H11-hindi-mixed"],"robustness":false,"corrections":null,"injectError":null}`

## Headline

| metric | value |
| --- | --- |
| fixtures | 8 |
| gtItems | 27 |
| predItems | 27 |
| itemPrecision | 0.852 |
| itemRecall | 0.852 |
| namePrecision | 0.963 |
| nameRecall | 0.963 |
| qtyAcc | 0.885 |
| qtyScored | 26 |
| priceAcc | 0.250 |
| priceScored | 4 |
| totalAcc | 1 |
| totalScored | 1 |
| cartValueAcc | 0 |
| cartValueScored | 1 |
| catalogAcc | 0.640 |
| catalogScored | 25 |
| jsonParseFailures | 0 |
| httpFailures | 0 |
| otherFailures | 0 |
| firstAttemptFailures | 4 |
| truncated | 0 |
| misroutedAsLedger | 0 |
| ambiguousAsked | 1 |
| latencyMsP50 | 11319 |
| latencyMsP95 | 93207 |
| promptTokensMean | 1627 |
| outputTokensMean | 348 |
| thoughtsTokensMean | - |
| totalTokensMean | 1975 |

## By tag

| tag | fixtures | gtItems | itemPrecision | itemRecall | nameRecall | qtyAcc | priceAcc | catalogAcc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviations | 3 | 11 | 0.909 | 0.909 | 0.909 | 1 | - | 0.600 |
| circled_qty | 5 | 16 | 0.938 | 0.938 | 0.938 | 1 | - | 0.643 |
| handwriting | 8 | 27 | 0.852 | 0.852 | 0.963 | 0.885 | 0.250 | 0.640 |
| hindi_names | 2 | 8 | 1 | 1 | 1 | 1 | - | 0.429 |
| qty_vs_price | 1 | 4 | 0.250 | 0.250 | 1 | 0.250 | 0.250 | 0.750 |
| rotated | 1 | 3 | 1 | 1 | 1 | 1 | - | 1 |
| size_as_qty | 1 | 3 | 1 | 1 | 1 | 1 | - | 1 |

## Failure causes (item level)

| cause | count |
| --- | --- |
| catalog_no_auto_match | 8 |
| price_read_as_qty | 2 |
| price_from_catalog | 2 |
| catalog_false_match | 1 |
| missing | 1 |
| qty_ambiguous_asked | 1 |
| price_missing | 1 |
| extra_item | 1 |

## Worst 10 cases

### H09-prices-total (f1: 0.250)

- price 80 read as quantity
- unit price 68 came from the catalog, bill says 80
- price 28 read as quantity
- unit price 12 came from the catalog, bill says 28
- qty left for the merchant (ambiguous), expected 1
- no unit price read (bill says 150)
- not auto-matched (unmatched), expected "Rin Powder 500g"

### H05-brands (f1: 0.667)

- "Chings Schezwan" not extracted
- extra item "chips" (qty 1, price 58)

### H03-list-sizes-words (f1: 1)

- not auto-matched (suggest), expected "Sooji (Rava) 500g"
- auto-matched to "Thums Up 600ml" but the bill item is not in the catalog
- not auto-matched (suggest), expected "Besan 500g"

### H04-circled-qty (f1: 1)

- not auto-matched (unmatched), expected "Poha 500g"
- not auto-matched (unmatched), expected "Toor Dal 1kg"

### H11-hindi-mixed (f1: 1)

- not auto-matched (unmatched), expected "Gillette Mach3 Razor"
- not auto-matched (unmatched), expected "Haldiram Aloo Bhujia 200g"

### H06-overwritten (f1: 1)

- not auto-matched (unmatched), expected "Ariel Powder 500g"

### H01-rotated-list (f1: 1)

- no item-level errors (low score from extras or total only)

### H08-single (f1: 1)

- no item-level errors (low score from extras or total only)
