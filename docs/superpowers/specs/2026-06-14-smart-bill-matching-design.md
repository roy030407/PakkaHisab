# Smart Bill Matching - Design Spec

Date: 2026-06-14
Status: Approved (pending spec review)
Owner: Roy Harwani

## Problem

When a bill image is scanned, line items are not recognised against the store
catalog. Two concrete failures:

1. A bill line like "Basmati Rice 20" does not match the catalog entries
   "Basmati Rice 1kg" / "Basmati Rice 5kg", so it is flagged "Not in catalog -
   will be added as new product", creating duplicate products.
2. The system cannot tell whether the number "20" next to an item is the
   quantity or the price, and currently returns 0 for both.

Root cause (verified in code): matching is done entirely by the AI model, and
the extraction prompt only passes the store's top-20 most-frequent products as
context (lib/anthropic/extraction.ts). There is no code-side fuzzy matcher, no
variant awareness, and no quantity-vs-price disambiguation step.

## Goals

- Match a scanned line to an existing catalog product (including the right
  variant) even when the size, price, or quantity is missing or written loosely.
- Decide whether a bare number is the quantity or the price; when it cannot be
  decided, ask the merchant to verify.
- Stop creating new products unless the merchant explicitly chooses to.

## Non-goals

- Deleting saved transactions from the customer ledger (tracked as a separate
  task).
- Voice input (Phase 7).
- Changing the upload / storage pipeline.

## Decisions (from brainstorm)

| Topic | Decision |
| --- | --- |
| Variant ambiguity | Smart: auto-pick the most likely variant when confident; show a chooser only when 2+ variants are genuinely plausible. |
| Qty/price + catalog price | Auto-fill the missing value from the catalog price and flag the row "check" (yellow) for a glance-and-confirm. |
| New-product policy | Match-first. Default each row to its best match; show "Did you mean..." suggestions when unsure; "Add as new" is a deliberate last resort. |
| Architecture | Hybrid: AI reads + normalizes each line; code matches against the full catalog and infers qty/price. |
| Fuzzy library | Fuse.js. |
| Spec scope | Matching engine + qty/price inference + scan-review row UI in this one spec. |

## Architecture (Hybrid)

```
POST /api/scan
  -> Gemini Vision: read + normalize each line (NO matching, NO product IDs)
  -> lib/scan/match.ts: match each line against the FULL store catalog
  -> lib/scan/inferQtyPrice.ts: decide qty vs price, auto-fill from catalog
  -> enriched ExtractionResult
  -> components/scan/ExtractionReview.tsx (5 row states)
  -> POST /api/scan/confirm: save resolved products; create new only on request
```

The AI does the hard reading (handwriting, typos, Hindi/English). Deterministic
code does matching, ranking, variant selection, and qty/price inference, because
every approved feature (ranked suggestions, confident variant auto-pick,
catalog-price auto-fill) is more reliable and testable as code.

## Component design

### 1. AI extraction - lib/anthropic/extraction.ts, lib/anthropic/prompts.ts

The model no longer returns `matched_product_id` or `needs_catalog_add`.
Per line item it returns:

- `productNameRaw` - verbatim text on the bill (e.g. "Bsmti Rce 20").
- `normalizedName` - cleaned, expanded product name (e.g. "basmati rice");
  expands common Hindi terms to English (chawal -> rice, cheeni -> sugar).
- `sizeToken` - any explicit size on the bill ("1kg", "500ml") or null.
- `numberTokens[]` - every number near the item, each as
  `{ value, guessedRole: "quantity"|"price"|"total"|"unknown", hasCurrencyMarker, hasMultiplyMarker, confidence }`.

Vendor, date, total, and document_type (single_bill | ledger_page) are
unchanged. The last-5 `extraction_corrections` stay in the prompt as few-shot
examples to improve reading accuracy.

### 2. Matching engine - NEW lib/scan/match.ts

Pure function. Inputs: normalized item + size token + the full catalog +
recent-frequency map. Loads active catalog rows (id, name, brand,
parent_product_id, unit, purchase_price, selling_price).

Algorithm:

1. Tokenize names; hold size tokens separately so "basmati rice" matches the
   family even though the catalog names carry a size suffix.
2. Fuzzy score every product (Fuse.js over name + brand).
3. Group hits by family: `parent_product_id` if present, else base name
   (name with the size token stripped).
4. Emit a `matchState`:
   - `matched` - one strong hit and the variant is clear.
   - `variant_choice` - family is clear but 2+ variants are plausible.
   - `suggest` - mid-confidence; return top-3 "did you mean" candidates.
   - `unmatched` - below the floor; offer "Add as new".
5. Variant smart-pick: if `sizeToken` is present, match it exactly; else choose
   the most-frequent variant; on a tie or no history, fall back to
   `variant_choice`.

Thresholds are constants tuned with the test fixtures (see Testing). Output per
item: `{ matchState, matchedProductId?, matchedVariantId?, candidates[] }`.

### 3. Qty/price inference - NEW lib/scan/inferQtyPrice.ts

Pure function. Inputs: `numberTokens` + matched product's catalog price `P`
(selling_price for sale, purchase_price for purchase).

Rules:

1. If a quantity and a price are both present and `qty * price ~= total`
   (within tolerance), accept them.
2. If only one bare number `n`:
   - `hasCurrencyMarker` -> price; `hasMultiplyMarker` -> quantity.
   - else if `n` is within a band around `P` -> price (quantity defaults to 1).
   - else if `n` is a small count far from `P` -> quantity, and auto-fill
     `unitPrice = P` with `fillSource = "catalog"`.
   - else (no catalog price, still ambiguous) -> `ambiguousQtyPrice = true`
     (the UI shows the qty/price toggle; nothing is assumed).
3. Set `needsVerify = true` whenever a value was auto-filled or inferred.

Output per item: `{ quantity, unitPrice, fillSource: "bill"|"catalog"|"inferred", needsVerify, ambiguousQtyPrice }`.

### 4. UI - components/scan/ExtractionReview.tsx

Renders the five approved row states:

1. Confident match - catalog name + "matched" check, qty/price filled.
2. Auto-filled - "price from catalog" yellow chip, glance-and-confirm.
3. Variant chooser - pills for the plausible variants (size + price).
4. Qty/price verify - a Quantity / Price toggle for the bare number.
5. Did you mean - ranked suggestion pills + a dashed "Add as new" last resort.

Save is blocked until every `variant_choice` and `ambiguousQtyPrice` row is
resolved or removed. Each row gets a remove (x) control (this also satisfies the
"remove a scan line item" request).

### 5. Types - types/index.ts

Extend the extraction item type with: `normalizedName`, `sizeToken`,
`numberTokens[]`, `matchState`, `candidates[]`, `matchedVariantId`, `fillSource`,
`needsVerify`, `ambiguousQtyPrice`.

### 6. Learning loop

When the merchant overrides a result (different variant/product, or flips
qty<->price), record it to `extraction_corrections` via the existing
/api/scan/correction route so future reads improve per store.

### 7. Confirm - app/api/scan/confirm/route.ts

Save the resolved `matchedProductId` / `matchedVariantId`. Create a new product
only for rows the merchant explicitly marked "Add as new".

## Error handling and edge cases

- Empty catalog: skip matching, go straight to the add-new flow.
- Ledger pages: run the resolver per transaction row.
- Bill total vs sum-of-lines mismatch: show a warning banner, do not block.
- Decimal weights (kg/litre): preserve fractional quantities.
- Multiple numbers on a line: use the line total to validate the qty x price.
- AI returns malformed JSON: existing parse guard stays; row falls back to
  `unmatched` rather than crashing the scan.

## Testing

Table-driven unit tests for the two pure functions, which carry the core risk:

- `lib/scan/match.ts` - exact, fuzzy, typo, family-vs-variant, tie-break, and
  unmatched cases.
- `lib/scan/inferQtyPrice.ts` - bare number as qty, bare number as price,
  currency/multiply markers, catalog auto-fill, and the ambiguous fall-through.

## Open questions

None. (Fuse.js and single-spec scope confirmed.)
