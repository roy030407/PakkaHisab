/**
 * FILE: components/shared/FrequentItems.tsx
 *
 * WHAT THIS DOES:
 *   Horizontal scrollable strip of the most-sold products as chips.
 *   Each chip shows the product name, price, and a + button.
 *   Tapping + calls the onAdd callback with the product.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Reusable on dashboard, entry, scan, voice, and products pages.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/dashboard/DashboardFrequentItems.tsx, components/entry/QuickEntry.tsx,
 *   app/(dashboard)/voice/page.tsx, components/scan/ExtractionReview.tsx,
 *   app/(dashboard)/products/page.tsx
 */
'use client'

import { useEffect, useState } from 'react'
import { Plus, Minus } from 'lucide-react'

export interface FrequentProduct {
  id: string
  name: string
  price: number
}

interface Props {
  onAdd: (product: FrequentProduct) => void
  onRemove?: (product: FrequentProduct) => void
  counts?: Map<string, number>
  label?: string
}

export function FrequentItems({ onAdd, onRemove, counts, label = 'Frequently sold' }: Props) {
  const [products, setProducts] = useState<FrequentProduct[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/products/frequent')
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || products.length === 0) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        {products.map(p => {
          const count = counts?.get(p.id) ?? 0
          return (
            <div key={p.id} className={`flex items-center gap-1.5 rounded-full border bg-white pl-3.5 pr-2 py-1.5 text-sm shadow-sm ${
              count > 0 ? 'border-emerald-400' : 'border-emerald-200'
            }`}>
              <span className="font-semibold text-gray-900 whitespace-nowrap">{p.name}</span>
              <span className="text-emerald-600 font-medium">&#8377;{p.price}</span>
              {count > 0 && onRemove && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(p) }}
                  className="btn-lift flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 cursor-pointer"
                  aria-label={`Remove one ${p.name}`}
                >
                  <Minus size={12} />
                </button>
              )}
              {count > 0 ? (
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">
                  {count}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onAdd(p)}
                className="btn-lift flex h-6 w-6 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 cursor-pointer"
                aria-label={`Add one ${p.name}`}
              >
                <Plus size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
