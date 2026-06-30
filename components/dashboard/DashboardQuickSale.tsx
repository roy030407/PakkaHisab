/**
 * FILE: components/dashboard/DashboardQuickSale.tsx
 *
 * WHAT THIS DOES:
 *   Mini quick-sale widget: sticky bar with item count, total, and a "Save sale"
 *   button that calls POST /api/entry/quick. Followed by a PaymentToggle after save.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Removed FrequentItems chip strip (no longer shown on dashboard)
 *   - Default payment changed from cash to upi
 *
 * WHERE IT FITS:
 *   Available for future use; currently not mounted on the dashboard page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PaymentToggle } from '@/components/shared/PaymentToggle'
import { track } from '@/lib/analytics/posthog'

interface CartItem { id: string; name: string; price: number }

export function DashboardQuickSale() {
  const router = useRouter()
  const [cart, setCart] = useState<Map<string, { product: CartItem; qty: number }>>(new Map())
  const [saving, setSaving] = useState(false)
  const [savedSale, setSavedSale] = useState<{ id: string; total: number } | null>(null)

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
          paymentMethod: 'upi',
          items: Array.from(cart.values()).map(v => ({
            productId: v.product.id,
            quantity: v.qty,
          })),
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const saleTotal = total
        setCart(new Map())
        if (data?.transactionId) {
          setSavedSale({ id: data.transactionId, total: saleTotal })
          track('sale_saved', { amount: saleTotal, itemCount, source: 'dashboard_quick' })
        } else {
          toast.success('Sale saved!')
        }
        router.refresh()
      } else {
        toast.error('Could not save. Try again.')
      }
    } catch {
      toast.error('Connection error. Try again.')
    }
    setSaving(false)
  }

  if (!savedSale) return null

  return (
    <div className="mt-2">
      <PaymentToggle
        transactionId={savedSale.id}
        total={savedSale.total}
        onDone={() => setSavedSale(null)}
      />
    </div>
  )
}
