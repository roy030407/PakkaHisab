/**
 * FILE: components/reports/TaxSummary.tsx
 *
 * WHAT THIS DOES:
 *   GST summary card: tax collected on sales, tax paid on purchases,
 *   net GST payable. Color-codes payable green (refund) or red (owe).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Placed on the reports page below the profit card.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */

import { formatINR } from "./StatCard"
import type { TaxSummary as TaxSummaryType } from "@/types"

interface Props {
  tax: TaxSummaryType
}

export function TaxSummary({ tax }: Props) {
  const payableColor = tax.payable >= 0 ? "text-red-600" : "text-green-700"
  const payableLabel = tax.payable >= 0 ? "GST payable to govt" : "GST credit (refundable)"

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">GST summary</p>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Collected on sales</span>
          <span className="font-medium text-gray-900">{formatINR(tax.collected)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Paid on purchases</span>
          <span className="font-medium text-gray-900">{formatINR(tax.paid)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
          <span className="font-semibold text-gray-900">{payableLabel}</span>
          <span className={`font-bold ${payableColor}`}>{formatINR(Math.abs(tax.payable))}</span>
        </div>
      </div>
    </div>
  )
}
