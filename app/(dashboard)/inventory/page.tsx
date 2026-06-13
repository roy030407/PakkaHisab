/**
 * FILE: app/(dashboard)/inventory/page.tsx
 *
 * WHAT THIS DOES:
 *   Main inventory screen. Shows:
 *   1. Upload schedule prompt (if no transactions in 24+ hours)
 *   2. AI ordering suggestions (OrderSuggestionCard)
 *   3. Expiry alerts (ExpiryAlert)
 *   4. Searchable stock list (StockList) with manual adjustment
 *   5. Top-5 critical/low products with consumption cards
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *   - Fix: restore per-item ExpiryAlert below the AttentionCard summary
 *
 * WHERE IT FITS:
 *   Accessed via /inventory route, BottomNav "Stock" tab.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx (inherits BottomNav)
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { StockItemWithConsumption, AdjustmentReason } from '@/types'
import { StockList } from '@/components/inventory/StockList'
import { ConsumptionCard } from '@/components/inventory/ConsumptionCard'
import { OrderSuggestionCard } from '@/components/inventory/OrderSuggestionCard'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'
import { AttentionCard } from '@/components/shared/AttentionCard'
import { ExpiryAlert } from '@/components/inventory/ExpiryAlert'
import { StockTabs } from '@/components/shared/StockTabs'

interface InventoryResponse {
  items: StockItemWithConsumption[]
}

export default function InventoryPage() {
  const [items, setItems] = useState<StockItemWithConsumption[]>([])
  const [loading, setLoading] = useState(true)
  const [lastTxDate, setLastTxDate] = useState<string | null>(null)
  const [uploadPromptDismissed, setUploadPromptDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [invRes, txRes] = await Promise.all([
      fetch('/api/inventory'),
      fetch('/api/transactions/last'),
    ])
    if (invRes.ok) {
      const data: InventoryResponse = await invRes.json()
      setItems(data.items)
    }
    if (txRes.ok) {
      const data = await txRes.json()
      setLastTxDate(data.lastDate ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdjust(productId: string, delta: number, reason: AdjustmentReason) {
    await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, delta, reason }),
    })
    await load()
  }

  // Show upload prompt if last transaction was more than 24h ago
  const showUploadPrompt = !uploadPromptDismissed && lastTxDate != null && (() => {
    const ageMs = Date.now() - new Date(lastTxDate).getTime()
    return ageMs > 24 * 60 * 60 * 1000
  })()

  // Products with alerting consumption data (stockout <= 7 days), show top 5
  const consumptionAlerts = items
    .filter(i => i.consumption && i.consumption.daysUntilStockout <= 7 && i.consumption.dailyRate > 0)
    .slice(0, 5)

  if (loading) {
    return <ListPageSkeleton rows={6} />
  }

  // Derive counts for AttentionCard from already-fetched items
  const lowStockCount = items.filter(i => i.stockStatus === 'low' || i.stockStatus === 'critical' || i.stockStatus === 'out').length
  const expiryCount = items.filter(item => {
    if (!item.expiryDate || item.currentStock <= 0) return false
    const daysUntil = Math.ceil(
      (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysUntil <= 7
  }).length

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5 pb-24">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Stock</h1>
        <StockTabs />
      </div>

      {/* Upload schedule prompt */}
      {showUploadPrompt && lastTxDate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-900">
              No transactions since {new Date(lastTxDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">Upload now to keep inventory accurate.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/scan" className="text-xs font-semibold text-emerald-700">
              Scan bill
            </Link>
            <button
              onClick={() => setUploadPromptDismissed(true)}
              className="text-blue-400 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Consolidated attention card (summary strip) */}
      <AttentionCard lowStockCount={lowStockCount} expiryCount={expiryCount} href="/inventory" />

      {/* Per-item expiry detail - lists which products expire, with units and days left */}
      <ExpiryAlert items={items} />

      {/* AI ordering suggestions */}
      <OrderSuggestionCard />

      {/* Consumption alerts (stockout within 7 days) */}
      {consumptionAlerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Running low soon</p>
          {consumptionAlerts.map(item => (
            <ConsumptionCard
              key={item.productId}
              productName={item.productName}
              unit={item.unit}
              currentStock={item.currentStock}
              consumption={item.consumption!}
            />
          ))}
        </div>
      )}

      {/* Full stock list */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">All products</p>
        <StockList items={items} onAdjust={handleAdjust} />
      </div>
    </div>
  )
}
