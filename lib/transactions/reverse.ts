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
 *   - balanceReversalAmount now reverses 'payment' rows (re-adds to balance)
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
 * Deleting a transaction may need to undo its effect on the customer balance.
 * A credit sale increased the balance, so we subtract (positive reversal). A
 * payment decreased the balance, so we re-add (negative reversal). Everything
 * else leaves the balance untouched. The caller applies: balance -= reversal.
 */
export function balanceReversalAmount(tx: {
  type: TransactionType
  paymentMethod: string
  customerId: string | null
  totalAmount: number
}): number {
  if (!tx.customerId) return 0
  // A credit sale increased the balance, so deleting it subtracts (positive reversal).
  if (tx.type === 'sale' && tx.paymentMethod === 'credit') {
    return Number(tx.totalAmount) || 0
  }
  // A payment decreased the balance, so deleting it re-adds (negative reversal).
  if (tx.type === 'payment') {
    return -(Number(tx.totalAmount) || 0)
  }
  return 0
}
