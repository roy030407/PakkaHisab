/**
 * FILE: lib/voice/buildCartRow.ts
 *
 * WHAT THIS DOES:
 *   Pure mapper. Given a spoken item and the catalog matcher's result, decides
 *   the cart row: use the matched product, else the best candidate, else flag
 *   it add-as-new (productId null) for the route to create. The spoken quantity
 *   is used verbatim (voice already knows the count - no qty inference).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Called per item by app/api/voice/parse/route.ts after matchItem().
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/voice/parse/route.ts ; imports MatchResult from lib/scan/match
 *   and VoiceParseItem from lib/voice/types
 */
import type { MatchResult } from '@/lib/scan/match'
import type { VoiceParseItem } from './types'

export interface PendingCartRow {
  productId: string | null // null => create an active product (add-as-new)
  name: string
  quantity: number
  unitPrice: number
  addAsNew: boolean
}

export function buildPendingRow(spoken: VoiceParseItem, match: MatchResult): PendingCartRow {
  const useId = match.matchedProductId ?? match.candidates[0]?.productId
  if (useId) {
    const cat = match.candidates.find(c => c.productId === useId)
    return {
      productId: useId,
      name: cat?.name ?? match.matchedProductName ?? spoken.name,
      quantity: spoken.quantity,
      unitPrice: cat?.unitPrice ?? 0,
      addAsNew: false,
    }
  }
  return {
    productId: null,
    name: spoken.name,
    quantity: spoken.quantity,
    unitPrice: 0,
    addAsNew: true,
  }
}
