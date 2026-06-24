/**
 * FILE: components/reports/ExpenseBreakdownCard.tsx
 *
 * WHAT THIS DOES:
 *   Renders a card with per-category expense breakdown using colored
 *   progress bars and percentage labels. Returns null when total is 0.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for expense category breakdown feature
 *
 * WHERE IT FITS:
 *   Displayed on the reports page between ItemsSoldCard and ProfitCard.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */

import type { ExpenseBreakdown } from '@/types'
import { formatINR } from './StatCard'

const CAT_LABELS: Record<string, string> = {
  rent: 'Rent',
  salaries: 'Salaries',
  electricity: 'Electricity',
  transport: 'Transport',
  other: 'Other',
}

const CAT_COLORS: Record<string, string> = {
  rent: 'bg-amber-400',
  salaries: 'bg-blue-400',
  electricity: 'bg-yellow-400',
  transport: 'bg-violet-400',
  other: 'bg-gray-400',
}

interface Props {
  breakdown: ExpenseBreakdown
  total: number
}

export function ExpenseBreakdownCard({ breakdown, total }: Props) {
  if (total === 0) return null

  const entries = Object.entries(breakdown).filter(([, amt]) => amt > 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">
        Expenses - {formatINR(total)}
      </p>
      <div className="space-y-2">
        {entries.map(([cat, amt]) => {
          const pct = Math.round((amt / total) * 100)
          return (
            <div key={cat}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">{CAT_LABELS[cat] ?? cat}</span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {formatINR(amt)} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${CAT_COLORS[cat] ?? 'bg-gray-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
