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
 *   components/dashboard/DashboardQuickSale.tsx, components/entry/QuickEntry.tsx,
 *   app/(dashboard)/products/page.tsx
 */
'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

export interface FrequentProduct {
  id: string
  name: string
  price: number
}

interface Props {
  onAdd: (product: FrequentProduct) => void
  counts?: Map<string, number>
  label?: string
}

export function FrequentItems({ onAdd, counts, label = 'Frequently sold' }: Props) {
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
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 px-1">{label}</p>
      <div className="flex flex-wrap gap-2">
        {products.map(p => {
          const count = counts?.get(p.id) ?? 0
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onAdd(p)}
              className="btn-lift flex items-center gap-1.5 rounded-full border border-gray-200 bg-white pl-3 pr-2 py-1.5 text-xs cursor-pointer"
            >
              <span className="font-medium text-gray-800 whitespace-nowrap">{p.name}</span>
              <span className="text-gray-400">&#8377;{p.price}</span>
              {count > 0 ? (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Plus size={12} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
