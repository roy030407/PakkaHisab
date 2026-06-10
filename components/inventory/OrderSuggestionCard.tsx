/**
 * FILE: components/inventory/OrderSuggestionCard.tsx
 *
 * WHAT THIS DOES:
 *   Shows three suggestion buckets (Order Today, Reduce Ordering, Watch Expiry).
 *   Each item in "Order Today" has a "Log purchase" CTA that navigates to /entry
 *   with the product pre-selected.
 *   Fetches /api/inventory/suggest on mount.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Top section of the inventory page, below the upload schedule prompt.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InventorySuggestionsResult, OrderSuggestion } from '@/types'

export function OrderSuggestionCard() {
  const [data, setData] = useState<InventorySuggestionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/inventory/suggest')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground animate-pulse">
      Loading suggestions...
    </div>
  )

  if (!data) return null

  const hasAnything = data.orderToday.length > 0 || data.reduceOrdering.length > 0 || data.watchExpiry.length > 0
  if (!hasAnything) return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
      All stock levels look good. No orders needed today.
    </div>
  )

  return (
    <div className="space-y-3">
      {data.orderToday.length > 0 && (
        <SuggestionSection
          title="Order today"
          items={data.orderToday}
          accentClass="border-red-200 bg-red-50"
          titleClass="text-red-800"
          showLogPurchase
          onLogPurchase={pid => router.push(`/entry?mode=full&productId=${pid}`)}
        />
      )}
      {data.watchExpiry.length > 0 && (
        <SuggestionSection
          title="Watch for expiry"
          items={data.watchExpiry}
          accentClass="border-amber-200 bg-amber-50"
          titleClass="text-amber-800"
          showLogPurchase={false}
          onLogPurchase={() => {}}
        />
      )}
      {data.reduceOrdering.length > 0 && (
        <SuggestionSection
          title="Reduce ordering"
          items={data.reduceOrdering}
          accentClass="border-slate-100 bg-slate-50"
          titleClass="text-slate-700"
          showLogPurchase={false}
          onLogPurchase={() => {}}
        />
      )}
    </div>
  )
}

function SuggestionSection({
  title,
  items,
  accentClass,
  titleClass,
  showLogPurchase,
  onLogPurchase,
}: {
  title: string
  items: OrderSuggestion[]
  accentClass: string
  titleClass: string
  showLogPurchase: boolean
  onLogPurchase: (productId: string) => void
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${accentClass}`}>
      <p className={`text-sm font-semibold ${titleClass}`}>{title}</p>
      {items.map(item => (
        <div key={item.productId} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
            <p className="text-xs text-muted-foreground">{item.reason}</p>
          </div>
          {showLogPurchase && (
            <button
              onClick={() => onLogPurchase(item.productId)}
              className="shrink-0 text-xs font-medium text-slate-700 underline underline-offset-2"
            >
              Log purchase
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
