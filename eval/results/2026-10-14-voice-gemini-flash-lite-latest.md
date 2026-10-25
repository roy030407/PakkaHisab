# Eval: voice / gemini-flash-lite-latest

Provider: gemini. Generated 2026-10-14T18:39:19.956Z. Options: `{"delayMs":5000,"retries":3,"cache":true,"only":["V01","V02","V04","V07","V08","V11","V13","C01","C02","C05","C06","C07","R01","R03","N04","N02","X-silence","X-long60","X-empty"],"robustness":false,"corrections":null,"injectError":null}`

## Headline

| metric | value |
| --- | --- |
| clips | 16 |
| corpusWer | 0.257 |
| meanWer | 0.280 |
| devanagariTranscripts | 0 |
| intentAcc | 0.938 |
| commandIntentAcc | 1 |
| itemsIntentAcc | 0.909 |
| itemPrecision | 0.813 |
| itemRecall | 0.650 |
| cartCatalogAcc | 0.769 |
| jsonFailuresSwallowed | 0 |
| httpFailures | 1 |
| firstAttemptFailures | 0 |
| truncated | 0 |
| latencyMsP50 | 1678 |
| latencyMsP95 | 2205 |
| promptTokensMean | 1327 |
| outputTokensMean | 100 |
| thoughtsTokensMean | - |

## By tag

| tag | clips | intentAcc | itemPrecision | itemRecall | wer |
| --- | --- | --- | --- | --- | --- |
| code_mixed_numbers | 4 | 1 | 0.833 | 0.833 | 0.333 |
| command | 5 | 1 | - | - | 0 |
| customer | 1 | 1 | - | - | 0 |
| hindi_names | 2 | 1 | 1 | 1 | 0.182 |
| hinglish_numbers | 3 | 1 | 0.857 | 0.857 | 0.053 |
| items | 11 | 0.909 | 0.813 | 0.650 | 0.316 |
| noise | 2 | 1 | 0.667 | 0.400 | 0.462 |
| qty_vs_price | 1 | 1 | 1 | 1 | 0.400 |
| real_shop_noise | 3 | 0.667 | 1 | 0.250 | 0.556 |
| silver_label | 2 | 0.500 | - | 0 | 1 |

## Worst 10 cases

### R01 (reference: "Ek Bikaji", transcript: "ho gaya")

- intent: expected items/-, got command/close args {}
- "Bikaji" not extracted

### X-empty (reference: "", transcript: "")

- http 400: {"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}
- intent: expected items/-, got -/- args null

### N02 (reference: "Amul butter ek, Dairy Milk do, Kurkure teen", transcript: "Amul butter ek packet aur Maggi do packet")

- "Dairy Milk" not extracted
- "Kurkure" not extracted
- extra item "Nestlé Maggi Noodles 70g x2"

### R03 (reference: "Dairy Milk", transcript: "")

- "Dairy Milk" not extracted

### V13 (reference: "gyarah Maggi aur barah ande", transcript: "11 Maggi aur Barande")

- "egg" not extracted
- extra item "Barande x1"

### V02 (reference: "teen Thums Up, paanch Lays", transcript: "teen Thums Up paanch")

- "Thums Up" cart row -> new product, expected Thums Up 600ml
- "Lays" not extracted
- extra item "paanch x5"

### X-long60 (reference: "", transcript: "Do Maggi aur ek Parle-G")

- "Thums Up" not extracted
- "Lays" not extracted
- "sugar" not extracted
- "rice" not extracted
- "potato" not extracted
- "onion" not extracted
- "wheat flour" not extracted
- "besan" not extracted
- "egg" not extracted
- "Amul Butter" not extracted
- "Dairy Milk" not extracted
- "Kurkure" not extracted
- "Sprite" not extracted
- "Bisleri" not extracted
- "Nescafe" not extracted
- "Vim bar" not extracted
- "Harpic" not extracted
- "Surf Excel" not extracted

### N04 (reference: "teen Thums Up, paanch Lays", transcript: "teen thums up paanch reez")

- "Thums Up" cart row -> new product, expected Thums Up 600ml
- "Lays" not extracted

### X-silence (reference: "", transcript: "aur maggi dena")

- extra item "Nestlé Maggi Noodles 70g x1"

### V11 (reference: "pachees rupaye ka Parle-G", transcript: "25 ka Parle-G")

- no item-level errors (low score from extras or total only)
