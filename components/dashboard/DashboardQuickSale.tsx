/**
 * FILE: components/dashboard/DashboardQuickSale.tsx
 *
 * WHAT THIS DOES:
 *   Wraps FrequentItems with a mini-cart on the dashboard. Tapping a chip
 *   adds +1 to the running cart. A sticky bar appears at the bottom with
 *   item count, total, and a "Save sale" button that calls POST /api/entry/quick.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Rendered on the dashboard page above the quick action buttons.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */
'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FrequentItems, type FrequentProduct } from '@/components/shared/FrequentItems'

export function DashboardQuickSale() {
  const router = useRouter()
  const [cart, setCart] = useState<Map<string, { product: FrequentProduct; qty: number }>>(new Map())
  const [saving, setSaving] = useState(false)

  const addItem = useCallback((product: FrequentProduct) => {
    setCart(prev => {
      const next = new Map(prev)
      const existing = next.get(product.id)
      if (existing) {
        next.set(product.id, { ...existing, qty: existing.qty + 1 })
      } else {
        next.set(product.id, { product, qty: 1 })
      }
      return next
    })
  }, [])

  const removeItem = useCallback((product: FrequentProduct) => {
    setCart(prev => {
      const next = new Map(prev)
      const existing = next.get(product.id)
      if (!existing) return prev
      if (existing.qty <= 1) { next.delete(product.id) } else { next.set(product.id, { ...existing, qty: existing.qty - 1 }) }
      return next
    })
  }, [])

  const counts = new Map(Array.from(cart.entries()).map(([id, v]) => [id, v.qty]))
  const itemCount = Array.from(cart.values()).reduce((s, v) => s + v.qty, 0)
  const total = Array.from(cart.values()).reduce((s, v) => s + v.product.price * v.qty, 0)

  async function saveSale() {
    if (itemCount === 0 || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/entry/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sale',
          paymentMethod: 'cash',
          items: Array.from(cart.values()).map(v => ({
            productId: v.product.id,
            quantity: v.qty,
          })),
        }),
      })
      if (res.ok) {
        toast.success('Sale saved!')
        setCart(new Map())
        router.refresh()
      } else {
        toast.error('Could not save. Try again.')
      }
    } catch {
      toast.error('Connection error. Try again.')
    }
    setSaving(false)
  }

  return (
    <div>
      <FrequentItems onAdd={addItem} onRemove={removeItem} counts={counts} />
      {itemCount > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-2.5">
          <span className="text-sm text-white">
            {itemCount} item{itemCount !== 1 ? 's' : ''} - &#8377;{Math.round(total)}
          </span>
          <button
            type="button"
            onClick={saveSale}
            disabled={saving}
            className="btn-lift rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save sale'}
          </button>
        </div>
      )}
    </div>
  )
}
