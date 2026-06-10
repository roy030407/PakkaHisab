/**
 * FILE: components/inventory/StockList.tsx
 *
 * WHAT THIS DOES:
 *   Searchable list of all products with colour-coded stock status badges.
 *   Critical/low/out items appear first. Each row shows current stock,
 *   unit, and reorder point. Tapping a row opens a mini-adjustment sheet.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Main content area of the inventory page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
'use client'

import { useState } from 'react'
import type { StockItemWithConsumption, AdjustmentReason } from '@/types'

interface Props {
  items: StockItemWithConsumption[]
  onAdjust: (productId: string, delta: number, reason: AdjustmentReason) => Promise<void>
}

const STATUS_COLORS: Record<string, string> = {
  ok: 'bg-green-100 text-green-800',
  low: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
  out: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  low: 'Low',
  critical: 'Critical',
  out: 'Out',
}

export function StockList({ items, onAdjust }: Props) {
  const [search, setSearch] = useState('')
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [delta, setDelta] = useState(0)
  const [reason, setReason] = useState<AdjustmentReason>('correction')
  const [saving, setSaving] = useState(false)

  const filtered = items.filter(item =>
    item.productName.toLowerCase().includes(search.toLowerCase()) ||
    (item.brand ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (item.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave() {
    if (!adjusting || delta === 0) return
    setSaving(true)
    await onAdjust(adjusting, delta, reason)
    setAdjusting(null)
    setDelta(0)
    setSaving(false)
  }

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-3">
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {search ? 'No products match your search.' : 'No stock data yet. Add products and scan bills to see inventory here.'}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        {filtered.map((item, idx) => (
          <div
            key={item.productId}
            className={`flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors ${idx < filtered.length - 1 ? 'border-b border-border' : ''}`}
            onClick={() => { setAdjusting(item.productId); setDelta(0); setReason('correction') }}
          >
            {/* Status dot */}
            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.stockStatus]}`}>
              {STATUS_LABELS[item.stockStatus]}
            </span>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
              {item.brand && <p className="text-xs text-muted-foreground truncate">{item.brand}</p>}
            </div>

            {/* Stock count */}
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-foreground">
                {item.currentStock} <span className="font-normal text-muted-foreground text-xs">{item.unit}</span>
              </p>
              {item.reorderPoint > 0 && (
                <p className="text-xs text-muted-foreground">reorder @ {item.reorderPoint}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Adjustment bottom sheet */}
      {adjusting && (() => {
        const item = items.find(i => i.productId === adjusting)
        if (!item) return null
        return (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setAdjusting(null)}>
            <div
              className="w-full rounded-t-2xl bg-background border-t border-border p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-semibold text-base">{item.productName}</h3>
              <p className="text-sm text-muted-foreground">Current stock: {item.currentStock} {item.unit}</p>

              {/* Delta stepper */}
              <div>
                <p className="text-sm font-medium mb-2">Adjust by</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setDelta(d => d - 1)}
                    className="w-10 h-10 rounded-full bg-muted text-foreground text-xl flex items-center justify-center"
                  >-</button>
                  <span className={`min-w-[3rem] text-center text-lg font-bold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                  <button
                    onClick={() => setDelta(d => d + 1)}
                    className="w-10 h-10 rounded-full bg-slate-800 text-white text-xl flex items-center justify-center"
                  >+</button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-sm font-medium mb-2">Reason</p>
                <div className="flex flex-wrap gap-2">
                  {(['correction', 'damaged', 'expired', 'theft', 'waste', 'other'] as AdjustmentReason[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${reason === r ? 'bg-slate-800 text-white border-slate-800' : 'bg-background text-foreground border-border'}`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={delta === 0 || saving}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold text-sm disabled:opacity-40"
              >
                {saving ? 'Saving...' : `Save adjustment (${delta > 0 ? '+' : ''}${delta} ${item.unit})`}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
