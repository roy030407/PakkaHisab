/**
 * FILE: components/voice/VoiceCart.tsx
 *
 * WHAT THIS DOES:
 *   Presentational live cart for the voice session. Renders each row (name, +/-
 *   quantity, line total), a running total, and an empty-state coach line. All
 *   controls are tappable fallbacks so a mis-parse is never a dead end.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *   - New-item rows now say they are added to the catalog on save (they are
 *     no longer created at parse time)
 *
 * WHERE IT FITS:
 *   Rendered by app/(dashboard)/voice/page.tsx.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; uses lib/voice/cart.ts and lib/voice/types.ts
 */
'use client'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { cartTotal } from '@/lib/voice/cart'
import type { VoiceCartRow } from '@/lib/voice/types'

export function VoiceCart({
  rows,
  onSetQty,
}: {
  rows: VoiceCartRow[]
  onSetQty: (productId: string, quantity: number) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Tap the mic and say what is selling - &quot;2 doodh, 5 Parle-G&quot;.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-100">
      {rows.map((r) => (
        <div key={r.productId} className="row-lift flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-500">
              {r.unitPrice > 0 ? `₹${r.unitPrice} each` : 'No price set'}
              {r.addedAsNew ? ' - new item, added to catalog on save' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => onSetQty(r.productId, r.quantity - 1)}
              className="btn-lift flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 cursor-pointer"
            >
              {r.quantity <= 1 ? <Trash2 size={15} /> : <Minus size={15} />}
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums">{r.quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onSetQty(r.productId, r.quantity + 1)}
              className="btn-lift flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 cursor-pointer"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="w-16 text-right text-sm font-semibold tabular-nums text-gray-900">
            ₹{r.unitPrice * r.quantity}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-gray-500">Total</span>
        <span className="text-lg font-bold text-emerald-700 tabular-nums">₹{cartTotal(rows)}</span>
      </div>
    </div>
  )
}
