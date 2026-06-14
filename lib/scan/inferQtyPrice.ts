/**
 * FILE: lib/scan/inferQtyPrice.ts
 *
 * WHAT THIS DOES:
 *   Pure decision: given the number tokens the AI read near a bill line and the
 *   matched product's catalog price, decide the quantity and unit price. Auto-
 *   fills from the catalog where safe and flags the row for verification. When
 *   it genuinely cannot tell, marks the row ambiguous so the UI asks.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for smart bill matching
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
