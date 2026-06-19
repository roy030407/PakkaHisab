/**
 * FILE: lib/voice/cart.ts
 *
 * WHAT THIS DOES:
 *   Pure, immutable cart operations for the voice session: merge incoming
 *   matched rows (summing duplicates by productId), set a row's quantity
 *   (removing it at zero), and compute the running total.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Used by app/(dashboard)/voice/page.tsx to keep the live cart in sync as
 *   parsed phrases arrive and as the merchant taps +/-.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; imports VoiceCartRow from lib/voice/types
 */
import type { VoiceCartRow } from './types'

export function addRowsToCart(cart: VoiceCartRow[], incoming: VoiceCartRow[]): VoiceCartRow[] {
  const next = cart.map(r => ({ ...r }))
  for (const row of incoming) {
    const existing = next.find(r => r.productId === row.productId)
    if (existing) existing.quantity += row.quantity
    else next.push({ ...row })
  }
  return next
}

export function setRowQuantity(cart: VoiceCartRow[], productId: string, quantity: number): VoiceCartRow[] {
  if (quantity <= 0) return cart.filter(r => r.productId !== productId)
  return cart.map(r => (r.productId === productId ? { ...r, quantity } : r))
}

export function cartTotal(cart: VoiceCartRow[]): number {
  return cart.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0)
}
