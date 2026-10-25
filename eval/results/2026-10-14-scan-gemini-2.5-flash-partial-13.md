# Eval: scan / gemini-2.5-flash (partial-13)

Provider: gemini. Generated 2026-10-14T18:38:00.137Z. Options: `{"delayMs":4500,"retries":0,"cache":true,"only":["P01-ganesh","P02-ganesh-crop","P03-thermal","P04-thermal-roundoff","D01-digital-perkg","D02-digital-kul","D03-digital-yog","D04-digital-dozen","H01-rotated-list","H02-list","H03-list-sizes-words","H04-circled-qty","H05-brands"],"robustness":false,"corrections":null,"injectError":null}`

## Headline

| metric | value |
| --- | --- |
| fixtures | 13 |
| gtItems | 66 |
| predItems | 52 |
| itemPrecision | 0.904 |
| itemRecall | 0.712 |
| namePrecision | 0.981 |
| nameRecall | 0.773 |
| qtyAcc | 0.961 |
| qtyScored | 51 |
| priceAcc | 0.889 |
| priceScored | 36 |
| totalAcc | 0.750 |
| totalScored | 8 |
| cartValueAcc | 0.571 |
| cartValueScored | 7 |
| catalogAcc | 0.681 |
| catalogScored | 47 |
| jsonParseFailures | 2 |
| httpFailures | 0 |
| otherFailures | 0 |
| firstAttemptFailures | 0 |
| truncated | 2 |
| misroutedAsLedger | 0 |
| ambiguousAsked | 1 |
| latencyMsP50 | 13463 |
| latencyMsP95 | 25977 |
| promptTokensMean | 806 |
| outputTokensMean | 800 |
| thoughtsTokensMean | 1713 |
| totalTokensMean | 3319 |

## By tag

| tag | fixtures | gtItems | itemPrecision | itemRecall | nameRecall | qtyAcc | priceAcc | catalogAcc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviations | 3 | 13 | 0.917 | 0.846 | 0.846 | 1 | 1 | 0.455 |
| circled_qty | 2 | 7 | 0.833 | 0.714 | 0.714 | 1 | - | 0.750 |
| devanagari | 3 | 19 | 0.667 | 0.421 | 0.632 | 0.833 | 0.667 | 0.667 |
| digital | 4 | 25 | 1 | 0.480 | 0.480 | 1 | 1 | 0.778 |
| gst | 3 | 19 | 1 | 0.632 | 0.632 | 1 | 1 | 0.500 |
| handwriting | 7 | 29 | 0.821 | 0.793 | 0.931 | 0.926 | 0.667 | 0.731 |
| hindi_names | 1 | 4 | 1 | 1 | 1 | 1 | - | 1 |
| multi_column | 8 | 49 | 0.889 | 0.653 | 0.735 | 0.944 | 0.889 | 0.636 |
| per_unit_rate | 4 | 25 | 1 | 0.480 | 0.480 | 1 | 1 | 0.778 |
| printed | 2 | 12 | 1 | 1 | 1 | 1 | 1 | 0.500 |
| qty_vs_price | 3 | 18 | 0.778 | 0.778 | 1 | 0.889 | 0.778 | 0.688 |
| rotated | 1 | 3 | 1 | 1 | 1 | 1 | - | 1 |
| size_as_qty | 2 | 6 | 1 | 1 | 1 | 1 | - | 1 |

## Failure causes (item level)

| cause | count |
| --- | --- |
| missing | 15 |
| catalog_no_auto_match | 10 |
| catalog_wrong_match | 5 |
| line_total_as_unit_price | 2 |
| qty_absorbed_by_size | 1 |
| price_from_catalog | 1 |
| qty_ambiguous_asked | 1 |
| price_missing | 1 |
| extra_item | 1 |

## Worst 10 cases

### D03-digital-yog (f1: 0)

- json_parse: Unterminated string in JSON at position 3541 (line 136 column 15)

### D04-digital-dozen (f1: 0)

- json_parse: Unexpected end of JSON input

### H05-brands (f1: 0.400)

- not auto-matched (suggest, correct one offered as a suggestion), expected "Amul Butter 500g"
- "Bread" not extracted
- "Chings Schezwan" not extracted
- extra item "Unknown product" (qty 1, price 0)

### P02-ganesh-crop (f1: 0.667)

- auto-matched to "Toor Dal 1kg", expected "Salt 1kg"
- not auto-matched (suggest, correct one offered as a suggestion), expected "Wheat Flour (Atta) 5kg"
- line total 20 used as unit price (should be 10)
- line total 90 used as unit price (should be 45)

### P01-ganesh (f1: 0.667)

- qty 1 was read as pack size "1kg", qty became 30
- unit price 120 came from the catalog, bill says 30
- auto-matched to "Toor Dal 1kg", expected "Salt 1kg"
- not auto-matched (suggest, correct one offered as a suggestion), expected "Wheat Flour (Atta) 5kg"
- qty left for the merchant (ambiguous), expected 1
- no unit price read (bill says 235)

### P03-thermal (f1: 1)

- auto-matched to "Toor Dal 1kg", expected "Salt 1kg"
- not auto-matched (suggest, correct one offered as a suggestion), expected "Wheat Flour (Atta) 5kg"
- not auto-matched (unmatched), expected "Parle-G 200g"

### P04-thermal-roundoff (f1: 1)

- auto-matched to "Toor Dal 1kg", expected "Salt 1kg"
- not auto-matched (suggest, correct one offered as a suggestion), expected "Wheat Flour (Atta) 5kg"
- not auto-matched (suggest, correct one offered as a suggestion), expected "Sunflower Oil 1L"

### H03-list-sizes-words (f1: 1)

- not auto-matched (suggest), expected "Sooji (Rava) 500g"
- not auto-matched (suggest), expected "Besan 500g"

### D01-digital-perkg (f1: 1)

- auto-matched to "Toor Dal 1kg", expected "Salt 1kg"

### D02-digital-kul (f1: 1)

- not auto-matched (suggest, correct one offered as a suggestion), expected "Sunflower Oil 1L"
