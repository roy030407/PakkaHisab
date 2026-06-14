/**
 * FILE: lib/transactions/reverse.ts
 *
 * WHAT THIS DOES:
 *   Pure helpers that compute how deleting a transaction must reverse its side
 *   effects: the per-product inventory deltas and the customer-balance delta.
 *   Kept pure (no DB) so the money/stock logic is unit-tested in isolation.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (extracted from DELETE /api/transactions/[id])
 *
 * WHERE IT FITS:
 *   Used by app/api/transactions/[id]/route.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/transactions/[id]/route.ts
 */
import type { TransactionType } from '@/types'

export interface ReverseLineItem {
  productId: string
  quantity: number
}

export interface InventoryReversal {
  productId: string
  delta: number
}

/**
 * Deleting a SALE puts goods back on the shelf (+qty); deleting a PURCHASE
 * takes them off (-qty). Expense/income never touch stock.
 */
export function inventoryReversals(
  txType: TransactionType,
  lineItems: ReverseLineItem[]
): InventoryReversal[] {
  if (txType !== 'sale' && txType !== 'purchase') return []
  const sign = txType === 'sale' ? 1 : -1
  return lineItems.map(li => ({ productId: li.productId, delta: sign * (Number(li.quantity) || 0) }))
}

/**
 * A credit sale increased the customer's outstanding balance, so deleting it
 * must subtract that amount. Everything else leaves the balance untouched.
 */
export function balanceReversalAmount(tx: {
  type: TransactionType
  paymentMethod: string
  customerId: string | null
  totalAmount: number
}): number {
  if (tx.customerId && tx.paymentMethod === 'credit' && tx.type === 'sale') {
    return Number(tx.totalAmount) || 0
  }
  return 0
}
