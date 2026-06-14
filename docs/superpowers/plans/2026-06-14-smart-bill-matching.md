# Smart Bill Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match scanned bill lines to existing catalog products (right variant) even when size/price/quantity is missing, infer whether a bare number is quantity or price (auto-filling from the catalog and flagging for verify), and stop creating duplicate products.

**Architecture:** Hybrid. The AI (Gemini Vision) only reads and normalizes each bill line into a clean name + size token + number tokens. Deterministic server code then matches each line against the full store catalog (Fuse.js), smart-picks variants, and infers quantity vs price from catalog prices. The scan review UI renders five row states and blocks save until ambiguous rows are resolved.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase, Gemini (@google/genai), Fuse.js (new), Vitest (new, for unit tests).

---

## File structure

- Create `lib/scan/normalize.ts` — pure text/size helpers (normalizeText, parseSizeToken, stripSize, baseName).
- Create `lib/scan/match.ts` — pure `matchItem()` fuzzy matcher + variant resolution.
- Create `lib/scan/inferQtyPrice.ts` — pure `inferQtyPrice()` quantity-vs-price decision.
- Create `lib/scan/resolve.ts` — server: loads catalog + frequency, maps raw AI items to final `ExtractionItem[]` using the two pure functions.
- Create `lib/scan/match.test.ts`, `lib/scan/inferQtyPrice.test.ts`, `lib/scan/normalize.test.ts` — Vitest unit tests.
- Create `vitest.config.ts` — test config.
- Modify `types/index.ts` — new extraction types.
- Modify `lib/anthropic/extraction.ts` and `lib/anthropic/prompts.ts` — AI returns raw normalized items, no matching.
- Modify `app/api/scan/route.ts` — call `resolveItems()` after extraction.
- Modify `app/api/scan/confirm/route.ts` — honor explicit "add as new" + matched variant.
- Modify `components/scan/ExtractionReview.tsx` — five row states + per-row remove.
- Modify `package.json` — add Fuse.js, Vitest, `test` script.

Each file has one responsibility: `normalize` = text shaping, `match` = which product, `inferQtyPrice` = which number is what, `resolve` = data loading glue, the route = HTTP, the component = UI.

---

## Task 0: Add Vitest + Fuse.js

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install fuse.js && npm install -D vitest
```
Expected: both added to `package.json`, no errors.

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Verify the runner works**

Run: `npm test`
Expected: exits 0 with "No test files found" (no tests yet) — confirms Vitest is wired.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest + fuse.js for smart bill matching"
```

---

## Task 1: Extraction types

**Files:**
- Modify: `types/index.ts:208-230` (replace `ExtractionItem`, extend `ExtractionResult`)

- [ ] **Step 1: Replace the `ExtractionItem` block and add new types**

Replace the existing `ExtractionItem` interface (currently lines ~208-221) and keep `ExtractionResult` updated. New content:

```ts
export type NumberRole = "quantity" | "price" | "total" | "unknown";

export interface NumberToken {
  value: number;
  guessedRole: NumberRole;
  hasCurrencyMarker: boolean;   // a ₹ / Rs near it
  hasMultiplyMarker: boolean;   // an x / @ near it
  confidence: ConfidenceLevel;
}

// What the AI returns per line (reading only, no matching).
export interface RawExtractedItem {
  productNameRaw: string;
  normalizedName: string;
  sizeToken: string | null;
  numberTokens: NumberToken[];
}

export type MatchState = "matched" | "variant_choice" | "suggest" | "unmatched";
export type FillSource = "bill" | "catalog" | "inferred";

export interface MatchCandidate {
  productId: string;
  name: string;
  unitPrice: number;
  sizeToken: string | null;
}

// What the resolver produces and the UI consumes.
export interface ExtractionItem {
  productNameRaw: string;
  normalizedName?: string;
  sizeToken?: string | null;
  matchedProductId?: string;
  matchedProductName?: string;
  matchState: MatchState;
  candidates: MatchCandidate[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate?: number;
  fillSource: FillSource;
  needsVerify: boolean;
  ambiguousQtyPrice: boolean;
  numberTokens?: NumberToken[];
}

export interface ExtractionResult {
  documentType: DocumentType;
  vendorName?: string;
  date?: string;
  totalAmount?: number;
  confidence: ConfidenceLevel;
  items: ExtractionItem[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files that still reference the removed `needsCatalogAdd`/`fieldConfidence` (extraction.ts, ExtractionReview.tsx, confirm route). These are fixed in later tasks. Note them and continue.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): extraction types for hybrid matching"
```

---

## Task 2: Normalize helpers (TDD)

**Files:**
- Create: `lib/scan/normalize.ts`
- Test: `lib/scan/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeText, parseSizeToken, stripSize, baseName } from '@/lib/scan/normalize'

describe('normalizeText', () => {
  it('lowercases, strips punctuation, collapses spaces', () => {
    expect(normalizeText('  Basmati  Rice! ')).toBe('basmati rice')
  })
})

describe('parseSizeToken', () => {
  it('finds kg / ml sizes', () => {
    expect(parseSizeToken('Basmati Rice 1kg')).toBe('1kg')
    expect(parseSizeToken('Thums Up 200 ml')).toBe('200ml')
  })
  it('returns null when no size', () => {
    expect(parseSizeToken('Basmati Rice')).toBeNull()
  })
})

describe('stripSize + baseName', () => {
  it('removes the size from the name', () => {
    expect(stripSize('Basmati Rice 1kg')).toBe('Basmati Rice')
  })
  it('baseName normalizes the size-stripped name', () => {
    expect(baseName('Basmati Rice 5KG')).toBe('basmati rice')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scan/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/scan/normalize.ts
/**
 * FILE: lib/scan/normalize.ts
 *
 * WHAT THIS DOES:
 *   Pure text helpers for bill matching: normalize names, find and strip a
 *   size token (1kg, 200ml, ...), and compute a size-stripped base name.
 *
 * WHERE IT FITS:
 *   Used by lib/scan/match.ts and lib/scan/resolve.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/scan/match.ts, lib/scan/resolve.ts
 */
const SIZE_RE = /(\d+(?:\.\d+)?)\s?(kg|g|gm|gms|ml|l|ltr|litre|liter|pc|pcs|piece|dozen|box)\b/i

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSizeToken(name: string): string | null {
  const m = name.match(SIZE_RE)
  if (!m) return null
  return `${m[1]}${m[2].toLowerCase()}`.replace(/\s+/g, '')
}

export function stripSize(name: string): string {
  return name.replace(SIZE_RE, '').replace(/\s+/g, ' ').trim()
}

export function baseName(name: string): string {
  return normalizeText(stripSize(name))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scan/normalize.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/normalize.ts lib/scan/normalize.test.ts
git commit -m "feat(scan): normalize + size-token helpers"
```

---

## Task 3: Quantity-vs-price inference (TDD)

**Files:**
- Create: `lib/scan/inferQtyPrice.ts`
- Test: `lib/scan/inferQtyPrice.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/inferQtyPrice.test.ts
import { describe, it, expect } from 'vitest'
import { inferQtyPrice } from '@/lib/scan/inferQtyPrice'
import type { NumberToken } from '@/types'

const tok = (value: number, over: Partial<NumberToken> = {}): NumberToken => ({
  value, guessedRole: 'unknown', hasCurrencyMarker: false, hasMultiplyMarker: false, confidence: 'medium', ...over,
})

describe('inferQtyPrice', () => {
  it('keeps explicit qty and price when present', () => {
    const r = inferQtyPrice([tok(3, { guessedRole: 'quantity' }), tok(60, { guessedRole: 'price', hasCurrencyMarker: true })], 60)
    expect(r).toMatchObject({ quantity: 3, unitPrice: 60, ambiguousQtyPrice: false })
  })

  it('treats a currency-marked single number as price, qty defaults 1', () => {
    const r = inferQtyPrice([tok(60, { hasCurrencyMarker: true })], 60)
    expect(r).toMatchObject({ quantity: 1, unitPrice: 60, fillSource: 'bill', needsVerify: true })
  })

  it('treats a multiply-marked single number as quantity, price from catalog', () => {
    const r = inferQtyPrice([tok(20, { hasMultiplyMarker: true })], 60)
    expect(r).toMatchObject({ quantity: 20, unitPrice: 60, fillSource: 'catalog', needsVerify: true })
  })

  it('uses catalog price: number near catalog price is the price', () => {
    const r = inferQtyPrice([tok(58)], 60)
    expect(r).toMatchObject({ quantity: 1, unitPrice: 58, fillSource: 'bill', needsVerify: true })
  })

  it('uses catalog price: small number far from catalog price is the quantity, autofills price', () => {
    const r = inferQtyPrice([tok(20)], 60)
    expect(r).toMatchObject({ quantity: 20, unitPrice: 60, fillSource: 'catalog', needsVerify: true, ambiguousQtyPrice: false })
  })

  it('is ambiguous when a bare number has no catalog price to compare against', () => {
    const r = inferQtyPrice([tok(20)], null)
    expect(r).toMatchObject({ ambiguousQtyPrice: true, needsVerify: true })
  })

  it('derives the missing side from a total', () => {
    const r = inferQtyPrice([tok(5, { guessedRole: 'quantity' }), tok(300, { guessedRole: 'total' })], 60)
    expect(r).toMatchObject({ quantity: 5, unitPrice: 60 })
  })

  it('returns zeros + ambiguous when there are no numbers and no catalog price', () => {
    const r = inferQtyPrice([], null)
    expect(r).toMatchObject({ quantity: 0, unitPrice: 0, ambiguousQtyPrice: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scan/inferQtyPrice.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/scan/inferQtyPrice.ts
/**
 * FILE: lib/scan/inferQtyPrice.ts
 *
 * WHAT THIS DOES:
 *   Pure decision: given the number tokens the AI read near a bill line and the
 *   matched product's catalog price, decide the quantity and unit price. Auto-
 *   fills from the catalog where safe and flags the row for verification. When
 *   it genuinely cannot tell, marks the row ambiguous so the UI asks.
 *
 * WHERE IT FITS:
 *   Called per item by lib/scan/resolve.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/scan/resolve.ts
 */
import type { NumberToken, FillSource } from '@/types'

export interface QtyPriceResult {
  quantity: number
  unitPrice: number
  fillSource: FillSource
  needsVerify: boolean
  ambiguousQtyPrice: boolean
}

// A number within +/-15% of the catalog price is read as a price, not a count.
const PRICE_BAND = 0.15

function pick(tokens: NumberToken[], role: NumberToken['guessedRole']) {
  return tokens.find(t => t.guessedRole === role)
}

export function inferQtyPrice(
  tokens: NumberToken[],
  catalogPrice: number | null
): QtyPriceResult {
  const qtyTok = pick(tokens, 'quantity') ?? tokens.find(t => t.hasMultiplyMarker)
  const priceTok = pick(tokens, 'price') ?? tokens.find(t => t.hasCurrencyMarker)
  const totalTok = pick(tokens, 'total')

  // Both sides known.
  if (qtyTok && priceTok) {
    return { quantity: qtyTok.value, unitPrice: priceTok.value, fillSource: 'bill', needsVerify: false, ambiguousQtyPrice: false }
  }

  // Quantity known, derive/fill price.
  if (qtyTok && !priceTok) {
    if (totalTok && qtyTok.value > 0) {
      return { quantity: qtyTok.value, unitPrice: round2(totalTok.value / qtyTok.value), fillSource: 'inferred', needsVerify: true, ambiguousQtyPrice: false }
    }
    if (catalogPrice != null) {
      return { quantity: qtyTok.value, unitPrice: catalogPrice, fillSource: 'catalog', needsVerify: true, ambiguousQtyPrice: false }
    }
    return { quantity: qtyTok.value, unitPrice: 0, fillSource: 'bill', needsVerify: true, ambiguousQtyPrice: false }
  }

  // Price known, derive quantity.
  if (priceTok && !qtyTok) {
    if (totalTok && priceTok.value > 0) {
      return { quantity: Math.max(1, Math.round(totalTok.value / priceTok.value)), unitPrice: priceTok.value, fillSource: 'inferred', needsVerify: true, ambiguousQtyPrice: false }
    }
    return { quantity: 1, unitPrice: priceTok.value, fillSource: 'bill', needsVerify: true, ambiguousQtyPrice: false }
  }

  // A single bare unknown number: lean on the catalog price to disambiguate.
  const bare = tokens.filter(t => t.guessedRole === 'unknown' || t.guessedRole === 'total')
  if (bare.length === 1) {
    const n = bare[0].value
    if (catalogPrice != null && catalogPrice > 0) {
      const near = Math.abs(n - catalogPrice) / catalogPrice <= PRICE_BAND
      if (near) {
        return { quantity: 1, unitPrice: n, fillSource: 'bill', needsVerify: true, ambiguousQtyPrice: false }
      }
      // Far from the price -> read as a quantity, autofill the price.
      return { quantity: n, unitPrice: catalogPrice, fillSource: 'catalog', needsVerify: true, ambiguousQtyPrice: false }
    }
    // No catalog price to compare -> we cannot tell. Ask.
    return { quantity: 0, unitPrice: 0, fillSource: 'inferred', needsVerify: true, ambiguousQtyPrice: true }
  }

  // Nothing usable.
  if (catalogPrice != null) {
    return { quantity: 1, unitPrice: catalogPrice, fillSource: 'catalog', needsVerify: true, ambiguousQtyPrice: false }
  }
  return { quantity: 0, unitPrice: 0, fillSource: 'inferred', needsVerify: true, ambiguousQtyPrice: true }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scan/inferQtyPrice.test.ts`
Expected: PASS (all 8).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/inferQtyPrice.ts lib/scan/inferQtyPrice.test.ts
git commit -m "feat(scan): quantity-vs-price inference"
```

---

## Task 4: Catalog matcher (TDD)

**Files:**
- Create: `lib/scan/match.ts`
- Test: `lib/scan/match.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/match.test.ts
import { describe, it, expect } from 'vitest'
import { matchItem, type CatalogEntry } from '@/lib/scan/match'

const catalog: CatalogEntry[] = [
  { id: 'r1', name: 'Basmati Rice 1kg', brand: null, parentId: null, unitPrice: 60, freq: 5 },
  { id: 'r5', name: 'Basmati Rice 5kg', brand: null, parentId: null, unitPrice: 280, freq: 1 },
  { id: 'sg', name: 'Sugar 1kg', brand: null, parentId: null, unitPrice: 42, freq: 3 },
  { id: 'sp', name: 'Sprite 600ml', brand: 'Coca-Cola', parentId: null, unitPrice: 40, freq: 2 },
]

describe('matchItem', () => {
  it('matches a plain family name to the most-frequent variant when size is absent', () => {
    const r = matchItem({ normalizedName: 'basmati rice', sizeToken: null }, catalog)
    expect(r.matchState).toBe('matched')
    expect(r.matchedProductId).toBe('r1') // freq 5 wins
  })

  it('matches the exact variant when the size is present', () => {
    const r = matchItem({ normalizedName: 'basmati rice', sizeToken: '5kg' }, catalog)
    expect(r.matchState).toBe('matched')
    expect(r.matchedProductId).toBe('r5')
  })

  it('asks for the variant when sizes tie and no size is given', () => {
    const tied: CatalogEntry[] = [
      { id: 'a', name: 'Atta 1kg', brand: null, parentId: null, unitPrice: 50, freq: 2 },
      { id: 'b', name: 'Atta 5kg', brand: null, parentId: null, unitPrice: 230, freq: 2 },
    ]
    const r = matchItem({ normalizedName: 'atta', sizeToken: null }, tied)
    expect(r.matchState).toBe('variant_choice')
    expect(r.candidates.map(c => c.productId).sort()).toEqual(['a', 'b'])
  })

  it('suggests candidates for a fuzzy/typo name', () => {
    const r = matchItem({ normalizedName: 'bsmti rce', sizeToken: null }, catalog)
    expect(['suggest', 'matched']).toContain(r.matchState)
    expect(r.candidates.length).toBeGreaterThan(0)
  })

  it('returns unmatched for something not in the catalog', () => {
    const r = matchItem({ normalizedName: 'car battery', sizeToken: null }, catalog)
    expect(r.matchState).toBe('unmatched')
  })

  it('matches a single-variant family directly', () => {
    const r = matchItem({ normalizedName: 'sugar', sizeToken: null }, catalog)
    expect(r.matchState).toBe('matched')
    expect(r.matchedProductId).toBe('sg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scan/match.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/scan/match.ts
/**
 * FILE: lib/scan/match.ts
 *
 * WHAT THIS DOES:
 *   Pure catalog matcher. Given a normalized bill line (name + optional size)
 *   and the store catalog, finds the product family, picks the variant
 *   (exact size, else most-frequent, else ask), and classifies the result as
 *   matched / variant_choice / suggest / unmatched with ranked candidates.
 *
 * WHERE IT FITS:
 *   Called per item by lib/scan/resolve.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/scan/resolve.ts ; uses fuse.js and lib/scan/normalize.ts
 */
import Fuse from 'fuse.js'
import type { MatchState, MatchCandidate } from '@/types'
import { baseName, parseSizeToken, normalizeText } from './normalize'

export interface CatalogEntry {
  id: string
  name: string
  brand: string | null
  parentId: string | null
  unitPrice: number
  freq: number
}

export interface MatchInput {
  normalizedName: string
  sizeToken: string | null
}

export interface MatchResult {
  matchState: MatchState
  matchedProductId?: string
  matchedProductName?: string
  candidates: MatchCandidate[]
}

// Fuse score is 0 (perfect) .. 1 (worst).
const STRONG = 0.35
const SUGGEST = 0.6

interface Indexed extends CatalogEntry {
  base: string
  size: string | null
  familyKey: string
}

function toCandidate(e: Indexed): MatchCandidate {
  return { productId: e.id, name: e.name, unitPrice: e.unitPrice, sizeToken: e.size }
}

export function matchItem(item: MatchInput, catalog: CatalogEntry[]): MatchResult {
  if (catalog.length === 0) {
    return { matchState: 'unmatched', candidates: [] }
  }

  const indexed: Indexed[] = catalog.map(e => ({
    ...e,
    base: baseName(e.name),
    size: parseSizeToken(e.name),
    familyKey: e.parentId ?? baseName(e.name),
  }))

  const fuse = new Fuse(indexed, {
    keys: ['base', 'brand'],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.6,
  })

  const query = normalizeText(item.normalizedName)
  const results = fuse.search(query)
  if (results.length === 0 || (results[0].score ?? 1) > SUGGEST) {
    return { matchState: 'unmatched', candidates: [] }
  }

  const best = results[0]
  const bestScore = best.score ?? 1

  // Mid-confidence -> "did you mean": one representative per family, top 3.
  if (bestScore > STRONG) {
    const seen = new Set<string>()
    const candidates: MatchCandidate[] = []
    for (const r of results) {
      if (seen.has(r.item.familyKey)) continue
      seen.add(r.item.familyKey)
      candidates.push(toCandidate(r.item))
      if (candidates.length === 3) break
    }
    return { matchState: 'suggest', candidates }
  }

  // Strong family hit -> resolve the variant.
  const familyKey = best.item.familyKey
  const variants = indexed.filter(e => e.familyKey === familyKey)

  // Exact size requested.
  if (item.sizeToken) {
    const wanted = item.sizeToken.toLowerCase().replace(/\s+/g, '')
    const exact = variants.find(v => v.size === wanted)
    if (exact) {
      return { matchState: 'matched', matchedProductId: exact.id, matchedProductName: exact.name, candidates: variants.map(toCandidate) }
    }
    // Size given but no such variant -> let the merchant choose.
    return { matchState: 'variant_choice', candidates: variants.map(toCandidate) }
  }

  if (variants.length === 1) {
    return { matchState: 'matched', matchedProductId: variants[0].id, matchedProductName: variants[0].name, candidates: variants.map(toCandidate) }
  }

  // Most-frequent variant wins if there is a unique max with history.
  const maxFreq = Math.max(...variants.map(v => v.freq))
  const top = variants.filter(v => v.freq === maxFreq)
  if (maxFreq > 0 && top.length === 1) {
    return { matchState: 'matched', matchedProductId: top[0].id, matchedProductName: top[0].name, candidates: variants.map(toCandidate) }
  }

  return { matchState: 'variant_choice', candidates: variants.map(toCandidate) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scan/match.test.ts`
Expected: PASS (all 6). If the "suggest" typo case classifies as `matched`, that is acceptable (the test allows both).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/match.ts lib/scan/match.test.ts
git commit -m "feat(scan): fuzzy catalog matcher with variant resolution"
```

---

## Task 5: Resolver (catalog load + glue)

**Files:**
- Create: `lib/scan/resolve.ts`

- [ ] **Step 1: Write the implementation**

```ts
// lib/scan/resolve.ts
/**
 * FILE: lib/scan/resolve.ts
 *
 * WHAT THIS DOES:
 *   Server glue. Loads the full active catalog for a store plus a recent-
 *   purchase frequency map, then turns the AI's raw read items into final
 *   ExtractionItem rows by calling matchItem() and inferQtyPrice().
 *
 * WHERE IT FITS:
 *   Called by app/api/scan/route.ts after extractBillData().
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/route.ts ; uses lib/scan/match.ts + lib/scan/inferQtyPrice.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RawExtractedItem, ExtractionItem, TransactionType } from '@/types'
import { matchItem, type CatalogEntry } from './match'
import { inferQtyPrice } from './inferQtyPrice'

export async function resolveItems(
  supabase: SupabaseClient,
  storeId: string,
  items: RawExtractedItem[],
  txType: TransactionType = 'purchase'
): Promise<ExtractionItem[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, parent_product_id, purchase_price, selling_price')
    .eq('store_id', storeId)
    .eq('is_active', true)

  // Recent purchase frequency (last 30 days) for variant tie-breaking.
  const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('store_id', storeId)
    .gte('date', since)
  const txIds = (recentTx ?? []).map((t: { id: string }) => t.id)
  const freq: Record<string, number> = {}
  if (txIds.length > 0) {
    const { data: lineItems } = await supabase
      .from('transaction_items')
      .select('product_id')
      .in('transaction_id', txIds)
    for (const li of lineItems ?? []) freq[li.product_id] = (freq[li.product_id] ?? 0) + 1
  }

  const priceOf = (p: { purchase_price: number; selling_price: number }) =>
    Number(txType === 'purchase' ? p.purchase_price : p.selling_price) || 0

  const catalog: CatalogEntry[] = (products ?? []).map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    parentId: p.parent_product_id ?? null,
    unitPrice: priceOf(p),
    freq: freq[p.id] ?? 0,
  }))
  const catalogById = new Map(catalog.map(c => [c.id, c]))

  return items.map((raw): ExtractionItem => {
    const m = matchItem({ normalizedName: raw.normalizedName, sizeToken: raw.sizeToken }, catalog)
    const matchedPrice = m.matchedProductId ? catalogById.get(m.matchedProductId)?.unitPrice ?? null : null
    const qp = inferQtyPrice(raw.numberTokens, matchedPrice)
    return {
      productNameRaw: raw.productNameRaw,
      normalizedName: raw.normalizedName,
      sizeToken: raw.sizeToken,
      matchedProductId: m.matchedProductId,
      matchedProductName: m.matchedProductName,
      matchState: m.matchState,
      candidates: m.candidates,
      quantity: qp.quantity,
      unitPrice: qp.unitPrice,
      totalPrice: qp.quantity * qp.unitPrice,
      fillSource: qp.fillSource,
      needsVerify: qp.needsVerify,
      ambiguousQtyPrice: qp.ambiguousQtyPrice,
      numberTokens: raw.numberTokens,
    }
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `lib/scan/resolve.ts` (pre-existing errors in extraction.ts / ExtractionReview.tsx / confirm route remain until later tasks).

- [ ] **Step 3: Commit**

```bash
git add lib/scan/resolve.ts
git commit -m "feat(scan): resolver loads catalog and builds extraction items"
```

---

## Task 6: AI extraction returns raw read items

**Files:**
- Modify: `lib/anthropic/extraction.ts` (full rewrite of the prompt + return shape)

- [ ] **Step 1: Replace the file body**

Replace `extractBillData` so it (a) drops the top-20 product context and the matching fields, (b) asks for normalized read output, and (c) returns `{ documentType, vendorName, date, totalAmount, confidence, rawItems }`. Keep corrections few-shot.

```ts
/**
 * FILE: lib/anthropic/extraction.ts
 *
 * WHAT THIS DOES:
 *   Calls Gemini Vision to READ a bill. It normalizes each line into a clean
 *   name + size token + number tokens (with a guessed role per number). It does
 *   NOT match against the catalog - matching is done in code (lib/scan).
 *
 * CHANGES THIS SESSION:
 *   - Read-only output (normalizedName, sizeToken, numberTokens); matching moved
 *     to lib/scan/match.ts + resolve.ts.
 *
 * WHERE IT FITS:
 *   Called by app/api/scan/route.ts; its output is fed to resolveItems().
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/route.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RawExtractedItem, NumberToken, ConfidenceLevel, DocumentType } from '@/types'
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from './client'

export interface RawExtraction {
  documentType: DocumentType
  vendorName?: string
  date?: string
  totalAmount?: number
  confidence: ConfidenceLevel
  rawItems: RawExtractedItem[]
}

interface Correction { field_name: string; original_value: string; corrected_value: string }

export async function extractBillData(
  supabase: SupabaseClient,
  storeId: string,
  imageBase64: string,
  mimeType: string
): Promise<RawExtraction> {
  const { data: corrections } = await supabase
    .from('extraction_corrections')
    .select('field_name, original_value, corrected_value')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(5)

  const correctionLines = (corrections as Correction[] ?? [])
    .map(c => `In a previous scan for this store, '${c.original_value}' was read as '${c.corrected_value}' (field: ${c.field_name}).`)
    .join('\n')

  const systemInstruction = `You are a bill reader for Indian retail stores. READ the bill image into structured JSON. Do NOT try to match products to any catalog. Return ONLY valid JSON, no markdown.

Handle Indian formats: "Rs.", "₹", Devanagari numerals, Dr/Cr columns, "only" suffix, partial dates.

For each line item:
- product_name_raw: the text exactly as written on the bill.
- normalized_name: a clean English product name (expand common Hindi: chawal->rice, cheeni->sugar, atta->wheat flour, doodh->milk). No size, no numbers.
- size_token: any pack size on the line ("1kg","500ml","200ml") or null.
- number_tokens: EVERY number near the line. For each: value, guessed_role ("quantity" | "price" | "total" | "unknown"), has_currency_marker (true if a ₹/Rs touches it), has_multiply_marker (true if an x/@ touches it), confidence ("high"|"medium"|"low").
  Do not guess a role you are unsure of - use "unknown".

If the image is a ledger/account page with multiple bills, set document_type "ledger_page" and put each bill's lines in items as well (flatten).

${correctionLines ? `Store read corrections:\n${correctionLines}\n` : ''}

Return this JSON:
{
  "document_type": "single_bill" | "ledger_page",
  "vendor_name": string | null,
  "date": "YYYY-MM-DD" | null,
  "total_amount": number | null,
  "confidence": "high" | "medium" | "low",
  "items": [
    {
      "product_name_raw": string,
      "normalized_name": string,
      "size_token": string | null,
      "number_tokens": [
        { "value": number, "guessed_role": "quantity"|"price"|"total"|"unknown",
          "has_currency_marker": boolean, "has_multiply_marker": boolean,
          "confidence": "high"|"medium"|"low" }
      ]
    }
  ]
}`

  const genAI = getGeminiClient()
  const response = await genAI.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: 'Read all data from this bill image.' },
      ],
    }],
    config: { systemInstruction, maxOutputTokens: 4096, responseMimeType: 'application/json' },
  })

  let text = (response.text ?? '').trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  const raw = JSON.parse(text)

  const rawItems: RawExtractedItem[] = (raw.items ?? raw.transactions ?? []).map((it: Record<string, unknown>) => ({
    productNameRaw: String(it.product_name_raw ?? ''),
    normalizedName: String(it.normalized_name ?? it.product_name_raw ?? ''),
    sizeToken: (it.size_token as string) ?? null,
    numberTokens: ((it.number_tokens as Record<string, unknown>[]) ?? []).map((n): NumberToken => ({
      value: Number(n.value) || 0,
      guessedRole: (n.guessed_role as NumberToken['guessedRole']) ?? 'unknown',
      hasCurrencyMarker: Boolean(n.has_currency_marker),
      hasMultiplyMarker: Boolean(n.has_multiply_marker),
      confidence: (n.confidence as ConfidenceLevel) ?? 'low',
    })),
  }))

  return {
    documentType: raw.document_type ?? 'single_bill',
    vendorName: raw.vendor_name ?? undefined,
    date: raw.date ?? undefined,
    totalAmount: raw.total_amount ?? undefined,
    confidence: raw.confidence ?? 'low',
    rawItems,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: `extraction.ts` clean. Remaining errors only in `app/api/scan/route.ts` and `ExtractionReview.tsx` / confirm route.

- [ ] **Step 3: Commit**

```bash
git add lib/anthropic/extraction.ts
git commit -m "feat(scan): AI extraction reads + normalizes, no catalog matching"
```

---

## Task 7: Wire the scan route to the resolver

**Files:**
- Modify: `app/api/scan/route.ts` (the extraction + response section, ~lines 119-200)

- [ ] **Step 1: Update the extraction + response code**

Replace the `// Call Claude Vision extraction` block and everything after it through the final `return NextResponse.json({...})` with:

```ts
  // Read the bill with the AI, then resolve items against the catalog in code.
  let extraction
  try {
    const imageBase64 = buffer.toString('base64')
    const raw = await extractBillData(supabase, store.id, imageBase64, file.type)
    const items = await resolveItems(supabase, store.id, raw.rawItems, 'purchase')
    extraction = {
      documentType: raw.documentType,
      vendorName: raw.vendorName,
      date: raw.date,
      totalAmount: raw.totalAmount,
      confidence: raw.confidence,
      items,
    }
  } catch {
    await supabase
      .from('document_uploads')
      .update({ extraction_status: 'failed' })
      .eq('id', docUpload.id)
    return NextResponse.json({ error: 'extraction_failed' }, { status: 422 })
  }

  // Duplicate detection: same vendor + total within 24h
  let duplicateWarning: { date: string; id: string } | null = null
  if (extraction.vendorName && extraction.totalAmount != null) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('store_id', store.id)
      .eq('vendor_name', extraction.vendorName)
      .eq('total_amount', extraction.totalAmount)
      .gte('created_at', oneDayAgo)
      .limit(1)
      .maybeSingle()
    if (existing) duplicateWarning = { date: existing.created_at, id: existing.id }
  }

  await supabase
    .from('document_uploads')
    .update({
      extraction_status: 'extracted',
      raw_extraction_json: extraction as unknown as Record<string, unknown>,
      confidence: extraction.confidence,
    })
    .eq('id', docUpload.id)

  return NextResponse.json({ documentUploadId: docUpload.id, extraction, duplicateWarning })
```

- [ ] **Step 2: Add the resolver import**

At the top of the file, below the `extractBillData` import:
```ts
import { resolveItems } from '@/lib/scan/resolve'
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: scan/route.ts clean. Remaining errors only in `ExtractionReview.tsx` and confirm route.

- [ ] **Step 4: Commit**

```bash
git add app/api/scan/route.ts
git commit -m "feat(scan): resolve items against catalog in the scan route"
```

---

## Task 8: Scan review UI — five row states + remove

**Files:**
- Modify: `components/scan/ExtractionReview.tsx` (full rewrite of the item row + state)

- [ ] **Step 1: Rewrite the component**

Key changes: `EditableItem` carries `matchState`, `candidates`, `matchedProductId`, `matchedProductName`, `ambiguousQtyPrice`, `fillSource`, `needsVerify`, `removed`, `addAsNew`, plus a `qtyPriceChoice` for the toggle. Add helpers: `chooseVariant`, `chooseSuggestion`, `setAddAsNew`, `setQtyPriceMode`, `removeRow`. Block save when any visible row is `variant_choice` or `ambiguousQtyPrice` and not resolved/removed. Send `addAsNew` + `matchedProductId` in the payload.

```tsx
/**
 * FILE: components/scan/ExtractionReview.tsx
 *
 * WHAT THIS DOES:
 *   Single-bill confirm screen. Each row resolves to a catalog product through
 *   one of five states: matched, price-from-catalog (verify), variant chooser,
 *   quantity-vs-price toggle, and did-you-mean suggestions (with an explicit
 *   "Add as new" last resort). Rows can be removed. Save is blocked until every
 *   ambiguous row is resolved or removed.
 *
 * CHANGES THIS SESSION:
 *   - Rebuilt for hybrid matching: row states, variant/suggestion pills,
 *     qty/price toggle, per-row remove, save gating.
 *
 * WHERE IT FITS:
 *   Shown when scan state = 'review' and documentType = 'single_bill'.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/scan/page.tsx
 */
'use client'
import { useState } from 'react'
import type { ExtractionResult, ExtractionItem, MatchCandidate } from '@/types'
import { DuplicateWarning } from './DuplicateWarning'

type QtyPriceMode = 'unset' | 'quantity' | 'price'

interface EditableItem extends ExtractionItem {
  editedName: string
  editedQty: number
  editedPrice: number
  originalName: string
  addAsNew: boolean
  removed: boolean
  qtyPriceMode: QtyPriceMode
  bareNumber: number
}

interface Props {
  extraction: ExtractionResult
  documentUploadId: string
  duplicateWarning?: { date: string; id: string } | null
  onSave: (payload: {
    documentUploadId: string
    vendorName?: string
    date?: string
    totalAmount: number
    items: Array<{
      productNameRaw: string
      matchedProductId?: string
      addAsNew: boolean
      quantity: number
      unitPrice: number
      totalPrice: number
      taxRate?: number
    }>
  }) => void
}

export function ExtractionReview({ extraction, documentUploadId, duplicateWarning, onSave }: Props) {
  const [items, setItems] = useState<EditableItem[]>(
    extraction.items.map((item: ExtractionItem) => {
      const name = item.matchedProductName ?? item.productNameRaw
      const bareNumber = item.numberTokens?.find(t => t.guessedRole === 'unknown')?.value ?? 0
      return {
        ...item,
        editedName: name,
        editedQty: item.quantity,
        editedPrice: item.unitPrice,
        originalName: name,
        addAsNew: item.matchState === 'unmatched',
        removed: false,
        qtyPriceMode: 'unset',
        bareNumber,
      }
    })
  )
  const [vendorName, setVendorName] = useState(extraction.vendorName ?? '')
  const [date, setDate] = useState(extraction.date ?? '')
  const [showDuplicate, setShowDuplicate] = useState(!!duplicateWarning)
  const [saving, setSaving] = useState(false)

  const live = items.filter(i => !i.removed)
  const total = live.reduce((s, i) => s + i.editedQty * i.editedPrice, 0)

  function patch(idx: number, fn: (it: EditableItem) => EditableItem) {
    setItems(prev => prev.map((it, i) => (i === idx ? fn(it) : it)))
  }
  const adjustQty = (idx: number, delta: number) =>
    patch(idx, it => ({ ...it, editedQty: Math.max(0, it.editedQty + delta) }))
  const setPrice = (idx: number, v: string) =>
    patch(idx, it => ({ ...it, editedPrice: Math.max(0, Number(v) || 0) }))
  const setName = (idx: number, v: string) =>
    patch(idx, it => ({ ...it, editedName: v }))
  const removeRow = (idx: number) => patch(idx, it => ({ ...it, removed: true }))

  const chooseCandidate = (idx: number, c: MatchCandidate) =>
    patch(idx, it => ({
      ...it,
      matchedProductId: c.productId,
      matchedProductName: c.name,
      editedName: c.name,
      editedPrice: it.editedPrice > 0 ? it.editedPrice : c.unitPrice,
      matchState: 'matched',
      addAsNew: false,
      needsVerify: it.editedPrice > 0 ? it.needsVerify : true,
      fillSource: it.editedPrice > 0 ? it.fillSource : 'catalog',
    }))

  const markAddNew = (idx: number) =>
    patch(idx, it => ({ ...it, addAsNew: true, matchState: 'unmatched', matchedProductId: undefined }))

  const setQtyPriceMode = (idx: number, mode: QtyPriceMode) =>
    patch(idx, it => {
      if (mode === 'quantity') return { ...it, qtyPriceMode: mode, editedQty: it.bareNumber, ambiguousQtyPrice: false }
      if (mode === 'price') return { ...it, qtyPriceMode: mode, editedPrice: it.bareNumber, editedQty: it.editedQty || 1, ambiguousQtyPrice: false }
      return { ...it, qtyPriceMode: mode }
    })

  // Save is blocked while any live row is still unresolved.
  const unresolved = live.some(
    i => (i.matchState === 'variant_choice') || (i.ambiguousQtyPrice && i.qtyPriceMode === 'unset')
  )

  async function handleSave() {
    setSaving(true)
    const payload = {
      documentUploadId,
      vendorName: vendorName.trim() || undefined,
      date: date.trim() || undefined,
      totalAmount: total,
      items: live.filter(i => i.editedQty > 0).map(it => ({
        productNameRaw: it.editedName.trim() || it.originalName,
        matchedProductId: it.addAsNew ? undefined : it.matchedProductId,
        addAsNew: it.addAsNew,
        quantity: it.editedQty,
        unitPrice: it.editedPrice,
        totalPrice: it.editedQty * it.editedPrice,
        taxRate: it.taxRate,
      })),
    }
    onSave(payload)
    setSaving(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-emerald-700 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Vendor</label>
            <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Unknown vendor"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm font-semibold text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Date</label>
            <input value={date} onChange={e => setDate(e.target.value)} placeholder="Not detected"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
          </div>
        </div>
        <p className="text-3xl font-bold text-white mt-3">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      </div>

      <div className="flex-1 pb-32">
        {showDuplicate && duplicateWarning && (
          <DuplicateWarning date={duplicateWarning.date} onDismiss={() => setShowDuplicate(false)} />
        )}

        <div className="mx-4 mt-3 space-y-3">
          {items.map((item, idx) => {
            if (item.removed) return null
            const warn = item.needsVerify || item.matchState !== 'matched'
            return (
              <div key={idx} className={`rounded-xl border p-3 ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <input value={item.editedName} onChange={e => setName(idx, e.target.value)} aria-label="Product name"
                    className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-gray-900 outline-none hover:border-gray-200 focus:border-emerald-300 focus:bg-white" />
                  <button onClick={() => removeRow(idx)} aria-label="Remove item"
                    className="btn-lift text-gray-400 hover:text-red-600 px-1">✕</button>
                </div>

                {/* State chips / controls */}
                {item.matchState === 'matched' && !item.needsVerify && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">✓ matched</p>
                )}
                {item.matchState === 'matched' && item.needsVerify && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    ⚠ {item.fillSource === 'catalog' ? 'price filled from catalog' : 'please check'}
                  </p>
                )}

                {item.matchState === 'variant_choice' && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Which size?</p>
                    <div className="flex flex-wrap gap-2">
                      {item.candidates.map(c => (
                        <button key={c.productId} onClick={() => chooseCandidate(idx, c)}
                          className="btn-lift rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-emerald-400">
                          {c.sizeToken ? `${c.sizeToken} · ₹${c.unitPrice}` : `${c.name} · ₹${c.unitPrice}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {item.matchState === 'suggest' && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Did you mean:</p>
                    <div className="flex flex-wrap gap-2">
                      {item.candidates.map(c => (
                        <button key={c.productId} onClick={() => chooseCandidate(idx, c)}
                          className="btn-lift rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-emerald-400">
                          {c.name}
                        </button>
                      ))}
                      <button onClick={() => markAddNew(idx)}
                        className="btn-lift rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400">
                        + Add as new
                      </button>
                    </div>
                  </div>
                )}

                {item.matchState === 'unmatched' && (
                  <p className="mt-1 text-xs text-gray-500">Will be added as a new product.</p>
                )}

                {item.ambiguousQtyPrice && item.qtyPriceMode === 'unset' && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Is <b>{item.bareNumber}</b> the quantity or the price?</p>
                    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                      <button onClick={() => setQtyPriceMode(idx, 'quantity')} className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Quantity ({item.bareNumber})</button>
                      <button onClick={() => setQtyPriceMode(idx, 'price')} className="px-3 py-1.5 text-sm font-medium text-gray-700 border-l border-gray-300 hover:bg-gray-50">Price (₹{item.bareNumber})</button>
                    </div>
                  </div>
                )}

                {/* Price + qty steppers */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1">
                    <span className="text-xs text-gray-400">₹</span>
                    <input type="number" min="0" inputMode="decimal" value={item.editedPrice} onChange={e => setPrice(idx, e.target.value)} aria-label={`Price for ${item.editedName}`}
                      className="w-16 bg-transparent text-sm text-gray-900 outline-none" />
                    <span className="text-xs text-gray-400">each</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => adjustQty(idx, -1)} aria-label={`Decrease quantity for ${item.editedName}`}
                      className="btn-lift w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm hover:bg-gray-200">−</button>
                    <span className="text-sm font-bold text-gray-900 min-w-[20px] text-center">{item.editedQty}</span>
                    <button onClick={() => adjustQty(idx, 1)} aria-label={`Increase quantity for ${item.editedName}`}
                      className="btn-lift w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm hover:bg-emerald-800">+</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        <button onClick={handleSave} disabled={saving || unresolved || live.filter(i => i.editedQty > 0).length === 0}
          className="w-full bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-emerald-800">
          {saving ? 'Saving...' : unresolved ? 'Resolve highlighted items to save' : `Save purchase · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <p className="text-center text-xs text-gray-400">Tap any field above to fix it before saving.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: ExtractionReview.tsx clean. Remaining errors only in the confirm route (next task) and possibly `app/(dashboard)/scan/page.tsx` if it types the onSave payload — fix any payload type mismatch there to include `addAsNew` and drop `needsCatalogAdd`/`correctedFields`.

- [ ] **Step 3: Check the scan page passes the payload through**

Open `app/(dashboard)/scan/page.tsx`. If its `onSave` handler types the items array, align it to the new shape (`addAsNew: boolean`, no `needsCatalogAdd`). If it just forwards `payload` to `fetch('/api/scan/confirm')`, no change is needed.

- [ ] **Step 4: Commit**

```bash
git add components/scan/ExtractionReview.tsx app/\(dashboard\)/scan/page.tsx
git commit -m "feat(scan): five-state review rows, variant/suggest pills, qty-price toggle, remove"
```

---

## Task 9: Confirm route — explicit add-new + matched variant

**Files:**
- Modify: `app/api/scan/confirm/route.ts` (the `ConfirmItem` interface and the per-item loop)

- [ ] **Step 1: Update `ConfirmItem`**

Replace the `ConfirmItem` interface with:
```ts
interface ConfirmItem {
  productNameRaw: string
  matchedProductId?: string
  addAsNew: boolean
  quantity: number
  unitPrice: number
  totalPrice: number
  taxRate?: number
}
```

- [ ] **Step 2: Update the placeholder-creation condition**

In the per-item loop, replace:
```ts
    // Create placeholder product for unrecognised items
    if (item.needsCatalogAdd || !productId) {
```
with:
```ts
    // Create a product ONLY when the merchant explicitly chose "Add as new"
    // (or there is genuinely no verified match to attach to).
    if (item.addAsNew || !productId) {
```

- [ ] **Step 3: Remove the corrections block**

The corrections-learning block referenced `item.correctedFields`, which no longer exists. Delete the `if (item.correctedFields) { ... }` block. (Correction learning is now driven separately when the merchant overrides a match; out of scope for this task.)

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc exits 0 across the project; all Vitest suites PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/scan/confirm/route.ts
git commit -m "feat(scan): confirm honors explicit add-new and matched variant"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (manual).

- [ ] **Step 1: Run the app**

Run: `npm run dev`, log in, open `/scan`.

- [ ] **Step 2: Verify the scenarios**

- Upload/scan a bill with "Basmati Rice 20" while the catalog has "Basmati Rice 1kg" (₹60) and "Basmati Rice 5kg": the row resolves to a Basmati Rice variant (most-frequent auto-picked) with qty 20 and price ₹60 flagged "price filled from catalog".
- A line with a single number near the catalog price reads as the price.
- A genuinely ambiguous line (no catalog price) shows the Quantity/Price toggle and blocks save until chosen.
- A typo line shows "Did you mean" suggestions; choosing one attaches the catalog product (no new product created).
- The × removes a row and the total updates.
- Saving creates a transaction; no duplicate products appear in `/products` for matched items.

- [ ] **Step 3: Final typecheck + tests + commit (if any tweaks)**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all green.

```bash
git add -A
git commit -m "test(scan): manual e2e verification tweaks for smart matching"
```

---

## Self-review notes

- **Spec coverage:** AI read/normalize (Task 6) · full-catalog fuzzy match + variants (Task 4) · qty/price inference w/ catalog autofill (Task 3) · resolver glue (Task 5) · five UI states + remove (Task 8) · match-first/add-new-last-resort (Tasks 8-9) · types (Task 1) · tests (Tasks 2-4) · edge cases empty-catalog (match.ts) / ledger flatten (extraction prompt) / decimals (no integer coercion of qty in infer) — covered.
- **Out of scope (by design):** correction-learning on override and customer-ledger transaction delete are separate tasks.
- **Type consistency:** `RawExtraction.rawItems` → `resolveItems` → `ExtractionItem` (with `matchState`, `candidates`, `fillSource`, `needsVerify`, `ambiguousQtyPrice`) → `ExtractionReview` → confirm payload (`addAsNew`, `matchedProductId`). `CatalogEntry` is internal to match.ts/resolve.ts. Names checked consistent across tasks.
