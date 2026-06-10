/**
 * FILE: components/entry/ProductSearch.tsx
 *
 * WHAT THIS DOES:
 *   Searchable product dropdown. Filters by name, brand, item number.
 *   Results appear below input as a floating list. Closes on selection.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Bug fix: updated p.itemNumber/p.sellingPrice to snake_case
 *
 * WHERE IT FITS:
 *   Used in FullEntryForm product search bar.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/entry/FullEntryForm.tsx
 */
'use client'
import { useState } from 'react'
import type { Product } from '@/types'

interface Props {
  products: Product[]
  onSelect: (product: Product) => void
  placeholder?: string
}

export function ProductSearch({ products, onSelect, placeholder = 'Search products...' }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.length < 1 ? [] : products.filter(p => {
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q) ||
      String(p.item_number).includes(q)
  })

  return (
    <div className="relative">
      <input type="text" value={query} onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      {filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
          {filtered.slice(0, 20).map(p => (
            <button key={p.id} onClick={() => { onSelect(p); setQuery('') }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-400">#{p.item_number} &middot; &#8377;{Number(p.selling_price) || '—'}</p>
            </button>
          ))}
        </div>
      )}
      {query.length > 0 && filtered.length === 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-3">
          <p className="text-sm text-gray-500">No products found</p>
        </div>
      )}
    </div>
  )
}
