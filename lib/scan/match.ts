/**
 * FILE: lib/scan/match.ts
 *
 * WHAT THIS DOES:
 *   Pure catalog matcher. Given a normalized bill line (name + optional size)
 *   and the store catalog, finds the product family, picks the variant
 *   (exact size, else most-frequent, else ask), and classifies the result as
 *   matched / variant_choice / suggest / unmatched with ranked candidates.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for smart bill matching
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
