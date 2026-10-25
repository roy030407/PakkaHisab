# Eval: scan / gemini-3-flash-preview

Provider: gemini. Generated 2026-10-14T18:42:41.873Z. Options: `{"delayMs":5000,"retries":3,"cache":true,"only":["P01-ganesh","P03-thermal","P04-thermal-roundoff","D01-digital-perkg","D02-digital-kul","D03-digital-yog","D04-digital-dozen","H01-rotated-list","H02-list","H03-list-sizes-words","H04-circled-qty","H05-brands","H06-overwritten","H07-mixed-numbers","H08-single","H09-prices-total","H10-water-20","H11-hindi-mixed","H12-circled"],"robustness":false,"corrections":null,"injectError":null}`

## Headline

| metric | value |
| --- | --- |
| fixtures | 19 |
| gtItems | 80 |
| predItems | 52 |
| itemPrecision | 0.923 |
| itemRecall | 0.600 |
| namePrecision | 1 |
| nameRecall | 0.650 |
| qtyAcc | 0.922 |
| qtyScored | 51 |
| priceAcc | 0.826 |
| priceScored | 23 |
| totalAcc | 0.500 |
| totalScored | 8 |
| cartValueAcc | 0.375 |
| cartValueScored | 8 |
| catalogAcc | 0.771 |
| catalogScored | 48 |
| jsonParseFailures | 5 |
| httpFailures | 0 |
| otherFailures | 0 |
| firstAttemptFailures | 1 |
| truncated | 5 |
| misroutedAsLedger | 0 |
| ambiguousAsked | 1 |
| latencyMsP50 | 11169 |
| latencyMsP95 | 34590 |
| promptTokensMean | 1633 |
| outputTokensMean | 467 |
| thoughtsTokensMean | 2044 |
| totalTokensMean | 4144 |

## By tag

| tag | fixtures | gtItems | itemPrecision | itemRecall | nameRecall | qtyAcc | priceAcc | catalogAcc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviations | 5 | 20 | 1 | 0.850 | 0.850 | 1 | 1 | 0.688 |
| circled_qty | 7 | 22 | 1 | 0.864 | 0.864 | 1 | - | 0.706 |
| devanagari | 2 | 13 | - | 0 | 0 | - | - | - |
| digital | 4 | 25 | 1 | 0.240 | 0.240 | 1 | 1 | 1 |
| gst | 3 | 19 | 1 | 0.632 | 0.632 | 1 | 1 | 0.833 |
| handwriting | 13 | 43 | 0.882 | 0.698 | 0.791 | 0.879 | 0.200 | 0.710 |
| hindi_names | 2 | 8 | 1 | 1 | 1 | 1 | - | 0.571 |
| multi_column | 7 | 43 | 1 | 0.419 | 0.419 | 1 | 1 | 0.882 |
| per_unit_rate | 4 | 25 | 1 | 0.240 | 0.240 | 1 | 1 | 1 |
| printed | 2 | 12 | 1 | 1 | 1 | 1 | 1 | 0.833 |
| qty_vs_price | 5 | 20 | 0.500 | 0.200 | 0.400 | 0.429 | 0.200 | 0.667 |
| rotated | 1 | 3 | 1 | 1 | 1 | 1 | - | 1 |
| size_as_qty | 2 | 6 | 1 | 1 | 1 | 1 | - | 1 |

## Failure causes (item level)

| cause | count |
| --- | --- |
| missing | 28 |
| catalog_no_auto_match | 9 |
| price_read_as_qty | 3 |
| price_from_catalog | 3 |
| catalog_wrong_match | 2 |
| qty_ambiguous_asked | 1 |
| price_missing | 1 |
| extra_item | 0 |

## Worst 10 cases

### D03-digital-yog (f1: 0)

- json_parse: Unterminated string in JSON at position 404 (line 17 column 16)

### P01-ganesh (f1: 0)

- json_parse: Unexpected end of JSON input

### D01-digital-perkg (f1: 0)

- json_parse: Expected double-quoted property name in JSON at position 387 (line 16 column 40)

### D04-digital-dozen (f1: 0)

- json_parse: Unterminated string in JSON at position 410 (line 17 column 25)

### H05-brands (f1: 0)

- json_parse: Expected property name or '}' in JSON at position 418 (line 20 column 6)

### H10-water-20 (f1: 0)

- price 20 read as quantity
- unit price 15 came from the catalog, bill says 20

### H09-prices-total (f1: 0.250)

- price 80 read as quantity
- unit price 68 came from the catalog, bill says 80
- price 28 read as quantity
- unit price 12 came from the catalog, bill says 28
- auto-matched to "Maggi Noodles 70g", expected "Yippee Noodles 75g"
- qty left for the merchant (ambiguous), expected 1
- no unit price read (bill says 150)
- not auto-matched (unmatched), expected "Rin Powder 500g"

### H03-list-sizes-words (f1: 1)

- not auto-matched (suggest), expected "Sooji (Rava) 500g"
- not auto-matched (suggest), expected "Besan 500g"

### H04-circled-qty (f1: 1)

- not auto-matched (unmatched), expected "Poha 500g"
- not auto-matched (unmatched), expected "Toor Dal 1kg"

### H06-overwritten (f1: 1)

- not auto-matched (variant_choice), expected "Cadbury Dairy Milk 13g"
- auto-matched to "Everest Garam Masala 50g", expected "Ariel Powder 500g"
