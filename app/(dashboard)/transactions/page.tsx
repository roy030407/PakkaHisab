/**
 * FILE: app/(dashboard)/transactions/page.tsx
 *
 * WHAT THIS DOES:
 *   Full transaction history page with date navigation arrows,
 *   type filter chips (All/Sales/Purchases/Expenses), voided toggle,
 *   expandable rows with line items, and void functionality.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Tapping the date label opens the native calendar picker (month/year
 *     navigation), bounded between the store join date and today
 *
 * WHERE IT FITS:
 *   Accessible from the sidebar nav and dashboard link. Provides a
 *   browsable, day-by-day view of all transactions with inline detail
 *   and void capability.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/shared/Sidebar.tsx (nav link)
 *   app/(dashboard)/dashboard/page.tsx (history link)
 *   Consumes: GET /api/transactions, GET /api/transactions/[id], PATCH /api/transactions/[id]
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Ban, CalendarDays } from 'lucide-react'

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

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'sale', label: 'Sales' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'expense', label: 'Expenses' },
]

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDateLabel(dateStr: string): string {
  const today = todayIST()
  if (dateStr === today) return 'Today'
  if (dateStr === shiftDate(today, -1)) return 'Yesterday'
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(dateStr + 'T12:00:00'))
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

export default function TransactionsPage() {
  const [date, setDate] = useState(todayIST())
  const [typeFilter, setTypeFilter] = useState('')
  const [showVoided, setShowVoided] = useState(true)
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null)
  const [joinDate, setJoinDate] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setExpandedId(null)
    const params = new URLSearchParams({ date, includeVoided: String(showVoided), limit: '50' })
    if (typeFilter) params.set('type', typeFilter)
    try {
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setRows(data.transactions ?? [])
      if (data.storeCreatedAt) setJoinDate(data.storeCreatedAt)
    } catch { setRows([]) }
    setLoading(false)
  }, [date, typeFilter, showVoided])

  const openCalendar = useCallback(() => {
    const input = dateInputRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
      input.click()
    }
  }, [])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setLineItems([]); setConfirmVoidId(null); return }
    setExpandedId(id)
    setConfirmVoidId(null)
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/transactions/${id}`)
      if (res.ok) { const data = await res.json(); setLineItems(data.items ?? []) }
    } catch { /* silently handle fetch failure */ }
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
        setRows(prev => prev.map(r => r.id === id ? { ...r, voidedAt: new Date().toISOString() } : r))
        setExpandedId(null)
        setConfirmVoidId(null)
      }
    } catch { /* silently handle void failure */ }
    setVoidingId(null)
  }, [])

  const isToday = date === todayIST()
  const atJoinDate = joinDate !== null && date <= joinDate
  const dayTotal = rows.filter(r => !r.voidedAt).reduce((s, r) => {
    if (r.type === 'sale') return s + r.totalAmount
    if (r.type === 'purchase' || r.type === 'expense') return s - r.totalAmount
    return s
  }, 0)

  const sorted = [...rows].sort((a, b) => {
    if (a.voidedAt && !b.voidedAt) return 1
    if (!a.voidedAt && b.voidedAt) return -1
    return 0
  })

  return (
    <div className="page-enter mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Transactions</h1>

      {/* Date navigation */}
      <div className="relative flex items-center justify-between rounded-xl bg-white border border-gray-200 px-3 py-2.5 mb-3">
        <button onClick={() => { if (!atJoinDate) setDate(prev => shiftDate(prev, -1)) }}
          disabled={atJoinDate}
          aria-label="Previous day"
          className={`btn-lift flex h-8 w-8 items-center justify-center rounded-lg ${
            atJoinDate ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600 cursor-pointer'
          }`}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={openCalendar}
          aria-label="Pick a date from the calendar"
          className="btn-lift flex items-center gap-2 rounded-lg px-3 py-1 text-center hover:bg-gray-50 cursor-pointer">
          <CalendarDays size={15} className="text-gray-400" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">{formatDateLabel(date)}</span>
            <span className="block text-[10px] text-gray-400">{date}</span>
          </span>
        </button>
        {/* Hidden native date input: tapping the label above opens the
            phone's own calendar with month/year navigation. */}
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          min={joinDate ?? undefined}
          max={todayIST()}
          onChange={e => {
            const v = e.target.value
            if (!v) return
            const today = todayIST()
            const clamped = v > today ? today : (joinDate && v < joinDate ? joinDate : v)
            setDate(clamped)
          }}
          className="sr-only absolute left-1/2 top-full"
          tabIndex={-1}
          aria-hidden="true"
        />
        <button onClick={() => { if (!isToday) setDate(prev => shiftDate(prev, 1)) }}
          disabled={isToday}
          aria-label="Next day"
          className={`btn-lift flex h-8 w-8 items-center justify-center rounded-lg ${
            isToday ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600 cursor-pointer'
          }`}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 mb-3">
        {TYPE_FILTERS.map(f => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            className={`btn-lift rounded-full px-3.5 py-1.5 text-xs font-medium border cursor-pointer ${
              typeFilter === f.value
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
            }`}>
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)}
            className="rounded border-gray-300" />
          Voided
        </label>
      </div>

      {/* Day summary */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 mb-3 text-sm">
          <span className="text-gray-500">{rows.filter(r => !r.voidedAt).length} transactions</span>
          <span className={`font-semibold tabular-nums ${dayTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            Net: &#8377;{Math.abs(Math.round(dayTotal)).toLocaleString('en-IN')}
            {dayTotal < 0 ? ' out' : ' in'}
          </span>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No transactions on {formatDateLabel(date)}.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
          {sorted.map(tx => {
            const isVoided = !!tx.voidedAt
            const isExpanded = expandedId === tx.id
            const isConfirming = confirmVoidId === tx.id

            return (
              <div key={tx.id}>
                <button type="button" onClick={() => toggleExpand(tx.id)}
                  className={`row-lift w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer ${
                    isVoided ? 'opacity-50' : ''
                  }`}>
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
                            <button type="button"
                              onClick={e => { e.stopPropagation(); voidTransaction(tx.id) }}
                              disabled={voidingId === tx.id}
                              className="btn-lift rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer">
                              {voidingId === tx.id ? 'Voiding...' : 'Yes, void'}
                            </button>
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setConfirmVoidId(null) }}
                              className="btn-lift rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 cursor-pointer">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={e => { e.stopPropagation(); setConfirmVoidId(tx.id) }}
                            className="btn-lift inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 cursor-pointer">
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
      )}
    </div>
  )
}
