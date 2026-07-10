/**
 * FILE: components/dashboard/DashboardFrequentItems.tsx
 *
 * WHAT THIS DOES:
 *   Client island: renders the Most Popular Items strip on the dashboard
 *   home screen. Tapping + saves a 1-unit quick sale immediately (no cart,
 *   no extra screen) and refreshes the server-rendered totals - the
 *   "2 taps from home" principle for the single most common action.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Mounted on app/(dashboard)/dashboard/page.tsx, below the quick actions.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx ; uses components/shared/FrequentItems.tsx
 */
'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FrequentItems, type FrequentProduct } from '@/components/shared/FrequentItems'
import { track } from '@/lib/analytics/posthog'

export function DashboardFrequentItems() {
  const router = useRouter()

  async function addOne(p: FrequentProduct) {
    let res: Response
    try {
      res = await fetch('/api/entry/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sale',
          paymentMethod: 'upi',
          items: [{ productId: p.id, quantity: 1 }],
        }),
      })
    } catch {
      toast.error('Could not save - check your connection and try again.')
      return
    }
    if (!res.ok) {
      toast.error('Could not save. Please try again.')
      return
    }
    toast.success(`${p.name} sold`)
    track('sale_saved', { amount: p.price, itemCount: 1, source: 'dashboard_frequent' })
    router.refresh()
  }

  return (
    <FrequentItems onAdd={addOne} label="Most popular items" />
  )
}
