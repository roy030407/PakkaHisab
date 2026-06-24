/**
 * FILE: components/reports/ProfitCard.tsx
 *
 * WHAT THIS DOES:
 *   Detailed profit breakdown: sales, purchases, gross margin, fixed costs,
 *   net profit. Shows margin percentage. Color-codes net profit green/red.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *   - Khata Green restyle
 *   - Added expenses row between gross margin and fixed costs
 *
 * WHERE IT FITS:
 *   Placed on the reports page below the period toggle.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */

import { formatINR } from "./StatCard"
import type { PeriodReport } from "@/types"

interface Props {
  report: PeriodReport
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className={`text-sm ${bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color ?? "text-gray-900"}`}>{value}</span>
    </div>
  )
}

export function ProfitCard({ report }: Props) {
  const netColor = report.netProfit >= 0 ? "text-green-700" : "text-red-600"

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">Profit breakdown</p>
      <Row label="Total sales" value={formatINR(report.sales)} />
      <Row label="Total purchases" value={`- ${formatINR(report.purchases)}`} />
      <Row label="Gross margin" value={`${formatINR(report.grossMargin)} (${report.grossMargin > 0 && report.sales > 0 ? Math.round(report.grossMargin / report.sales * 100) : 0}%)`} />
      {(report.totalExpenses ?? 0) > 0 && (
        <Row label="Expenses" value={`- ${formatINR(report.totalExpenses ?? 0)}`} />
      )}
      <Row label="Fixed costs" value={`- ${formatINR(report.fixedCosts)}`} />
      <Row label="Net profit" value={formatINR(report.netProfit)} bold color={netColor} />
    </div>
  )
}
