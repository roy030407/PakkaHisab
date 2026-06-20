/**
 * FILE: components/dashboard/RecentTransactions.tsx
 *
 * WHAT THIS DOES:
 *   Client component that renders a list of today's transactions on the
 *   dashboard. Each row is tappable to expand and show line items. A "Void"
 *   button on the expanded view soft-deletes the transaction and reverses
 *   inventory + balance via PATCH /api/transactions/[id].
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (transaction history feature)
 *
 * WHERE IT FITS:
 *   Rendered inside app/(dashboard)/dashboard/page.tsx, below the stat cards.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Ban } from 'lucide-react'

interface TransactionRow {
  id: string
  date: string
  type: string
  totalAmount: number
  paymentMethod: string | null
  source: string
  customerName: string | null
  itemCount: number
  itemSummary: string
  createdAt: string
  voidedAt: string | null
}

interface LineItem {
  product_name_raw: string
  quantity: number
  unit_price: number
  total_price: number
}

const TYPE_STYLES: Record<string, string> = {
  sale: 'bg-emerald-100 text-emerald-800',
  purchase: 'bg-blue-100 text-blue-800',
  expense: 'bg-amber-100 text-amber-800',
  income: 'bg-violet-100 text-violet-800',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

export function RecentTransactions() {
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/transactions')
      .then(r => r.json())
      .then(d => setRows(d.transactions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setLineItems([])
      setConfirmVoidId(null)
      return
    }
    setExpandedId(id)
    setConfirmVoidId(null)
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/transactions/${id}`)
      if (res.ok) {
        const data = await res.json()
        setLineItems(data.items ?? [])
      }
    } catch { /* network error - items just won't show */ }
    setLoadingItems(false)
  }, [expandedId])

  const voidTransaction = useCallback(async (id: string) => {
    setVoidingId(id)
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      })
      if (res.ok) {
        setRows(prev => prev.map(r =>
          r.id === id ? { ...r, voidedAt: new Date().toISOString() } : r
        ))
        setExpandedId(null)
        setConfirmVoidId(null)
      }
    } catch { /* network error - void just won't happen */ }
    setVoidingId(null)
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
        Loading transactions...
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        No transactions today. Start selling!
      </div>
    )
  }

  const sorted = [...rows].sort((a, b) => {
    if (a.voidedAt && !b.voidedAt) return 1
    if (!a.voidedAt && b.voidedAt) return -1
    return 0
  })

  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-semibold text-gray-700 px-1">Today&apos;s transactions</h2>
      <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
        {sorted.map(tx => {
          const isVoided = !!tx.voidedAt
          const isExpanded = expandedId === tx.id
          const isConfirming = confirmVoidId === tx.id

          return (
            <div key={tx.id}>
              <button
                type="button"
                onClick={() => toggleExpand(tx.id)}
                className={`row-lift w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer ${
                  isVoided ? 'opacity-50' : ''
                }`}
              >
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  isVoided ? 'bg-gray-100 text-gray-500' : (TYPE_STYLES[tx.type] ?? 'bg-gray-100 text-gray-600')
                }`}>
                  {isVoided ? 'Voided' : tx.type}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isVoided ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {tx.itemSummary || tx.type}
                  </p>
                  <p className="text-xs text-gray-400">
                    {tx.paymentMethod ?? ''}{tx.customerName ? ` - ${tx.customerName}` : ''}
                  </p>
                </div>

                <span className={`shrink-0 text-sm font-semibold tabular-nums ${
                  isVoided ? 'line-through text-gray-400' : 'text-gray-900'
                }`}>
                  &#8377;{tx.totalAmount}
                </span>

                <span className="shrink-0 text-xs text-gray-400 w-16 text-right">
                  {formatTime(tx.createdAt)}
                </span>

                <span className="shrink-0 text-gray-300">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-0 space-y-2">
                  {loadingItems ? (
                    <p className="text-xs text-gray-400 pl-2">Loading items...</p>
                  ) : lineItems.length > 0 ? (
                    <div className="rounded-lg bg-gray-50 divide-y divide-gray-100">
                      {lineItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                          <span className="text-gray-700">
                            {Number(item.quantity)} x {item.product_name_raw || 'Item'}
                          </span>
                          <span className="font-medium tabular-nums text-gray-700">
                            &#8377;{Number(item.total_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 pl-2">No line items</p>
                  )}

                  {!isVoided && (
                    <div className="flex justify-end">
                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-rose-600">Stock will be restored. Void?</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); voidTransaction(tx.id) }}
                            disabled={voidingId === tx.id}
                            className="btn-lift rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                          >
                            {voidingId === tx.id ? 'Voiding...' : 'Yes, void'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmVoidId(null) }}
                            className="btn-lift rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmVoidId(tx.id) }}
                          className="btn-lift inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 cursor-pointer"
                        >
                          <Ban size={12} /> Void
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
