/**
 * FILE: components/reports/ItemsSoldCard.tsx
 *
 * WHAT THIS DOES:
 *   Compact "Items sold this period" card. Collapsed, it previews the top 3
 *   products (quantity + revenue) and a total item count. Tapping expands it
 *   to the full revenue-sorted list in a scrollable panel, so it never takes
 *   over the whole reports page.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (per-item sales breakdown on the Reports page)
 *
 * WHERE IT FITS:
 *   Rendered on the Reports page. Driven by report.itemsSold, which respects
 *   the active daily/weekly/monthly/yearly period toggle.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */
'use client'

import { useState } from 'react'
import { ChevronDown, ShoppingBag } from 'lucide-react'
import { formatINR } from './StatCard'
import type { TopProduct } from '@/types'

interface Props {
  items: TopProduct[]
}

export function ItemsSoldCard({ items }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900 mb-1">Items sold</p>
        <p className="text-xs text-gray-400">No sales recorded in this period yet.</p>
      </div>
    )
  }

  const preview = items.slice(0, 3)
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0)
  const shown = expanded ? items : preview

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="btn-lift w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-emerald-700" />
          <span className="text-sm font-semibold text-gray-900">Items sold</span>
          <span className="text-xs text-gray-400">
            {items.length} item{items.length !== 1 ? 's' : ''} &middot; {totalUnits} units
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={expanded ? 'max-h-80 overflow-y-auto' : ''}>
        {shown.map((item, i) => (
          <div
            key={item.productId + i}
            className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-semibold text-gray-400 w-5 shrink-0">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.quantity} sold</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
              {formatINR(item.revenue)}
            </p>
          </div>
        ))}
      </div>

      {!expanded && items.length > 3 && (
        <button
          onClick={() => setExpanded(true)}
          className="btn-lift w-full border-t border-gray-100 px-4 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          View all {items.length} items
        </button>
      )}
    </div>
  )
}
