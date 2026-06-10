/**
 * FILE: lib/reports/tax.ts
 *
 * WHAT THIS DOES:
 *   Calculates GST liability for a period from transaction rows.
 *   Returns tax collected on sales, tax paid on purchases, and net payable.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *
 * WHERE IT FITS:
 *   Used by /api/reports to produce the TaxSummary card.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/reports/route.ts
 */

import type { TaxSummary } from '@/types'

export function calculateTax(
  rows: { type: string; tax_amount: string | number }[]
): TaxSummary {
  let collected = 0
  let paid = 0

  for (const row of rows) {
    const amt = Number(row.tax_amount) || 0
    if (row.type === 'sale') collected += amt
    else if (row.type === 'purchase') paid += amt
  }

  return {
    collected: Math.round(collected),
    paid: Math.round(paid),
    payable: Math.round(collected - paid),
  }
}
