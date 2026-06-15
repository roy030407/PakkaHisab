/**
 * FILE: app/(dashboard)/customers/page.tsx
 *
 * WHAT THIS DOES:
 *   Customer hub with two tabs: All (searchable list) and Udhaar due (who owes,
 *   how old, with Receive payment + WhatsApp remind actions). Tapping a customer
 *   opens their ledger. The Udhaar tab is auto-selected via ?tab=udhaar.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *   - Slice A: Udhaar due tab (aging + receive payment + WhatsApp remind)
 *
 * WHERE IT FITS:
 *   Route /customers. Reached from BottomNav and the dashboard Udhaar card.
 *
 * CALLED BY / IMPORTS FROM:
 *   BottomNav, dashboard Udhaar card, ReceivePaymentSheet, RemindButton,
 *   lib/collections/aging
 */
'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users } from 'lucide-react'
import { CreditBadge } from '@/components/customers/CreditBadge'
import { CustomerLedger } from '@/components/customers/CustomerLedger'
import { ReceivePaymentSheet } from '@/components/customers/ReceivePaymentSheet'
import { RemindButton } from '@/components/customers/RemindButton'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'
import { customerAge } from '@/lib/collections/aging'

interface CustomerRow {
  id: string
  name: string
  phone?: string | null
  currentBalance: number
  creditLimit: number
  oldest_credit_at: string | null
  last_payment_at: string | null
}

function ageLine(c: CustomerRow): string {
  const { sinceDays, lastPaidDays } = customerAge({
    oldestCreditAt: c.oldest_credit_at,
    lastPaymentAt: c.last_payment_at,
  })
  const since = `Balance since ${sinceDays} din`
  const paid = lastPaidDays === null ? 'never paid' : `last paid ${lastPaidDays} din ago`
  return `${since} · ${paid}`
}

function CustomersInner() {
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'udhaar'>(searchParams.get('tab') === 'udhaar' ? 'udhaar' : 'all')
  const [shop, setShop] = useState<{ name: string; reminderTemplate: string | null }>({ name: '', reminderTemplate: null })
  const [payFor, setPayFor] = useState<CustomerRow | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    return fetch('/api/customers')
      .then(r => r.json())
      .then(d => {
        const rows: CustomerRow[] = (d.customers ?? []).map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          phone: (c.phone as string) ?? null,
          currentBalance: Number(c.current_balance ?? 0),
          creditLimit: Number(c.credit_limit ?? 0),
          oldest_credit_at: (c.oldest_credit_at as string) ?? null,
          last_payment_at: (c.last_payment_at as string) ?? null,
        }))
        setCustomers(rows)
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/stores')
      .then(r => r.json())
      .then(d => setShop({ name: d.store?.name ?? '', reminderTemplate: d.store?.reminder_template ?? null }))
      .catch(() => {})
  }, [])

  if (selected) {
    return <CustomerLedger customerId={selected} onBack={() => { setSelected(null); load() }} />
  }

  const udhaar = customers
    .filter(c => c.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance)
  const udhaarTotal = udhaar.reduce((s, c) => s + c.currentBalance, 0)

  const allFiltered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone ?? '').includes(query)
  )

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Customers</h1>

        {/* Segmented tabs */}
        <div className="mb-3 flex rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setTab('all')}
            className={`btn-lift flex-1 rounded-md py-1.5 font-medium ${tab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            All
          </button>
          <button
            onClick={() => setTab('udhaar')}
            className={`btn-lift flex-1 rounded-md py-1.5 font-medium ${tab === 'udhaar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Udhaar due &middot; &#8377;{udhaarTotal.toLocaleString('en-IN')}
          </button>
        </div>

        {tab === 'all' && (
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        )}
      </div>

      <div className="flex-1 px-4 py-3">
        {loading ? (
          <ListPageSkeleton rows={5} />
        ) : tab === 'all' ? (
          allFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Users size={22} className="text-emerald-700" />
              </div>
              <p className="text-sm font-medium text-gray-900">No customers yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                Customers are added when you record a sale - they&apos;ll appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {allFiltered.map(c => (
                <button key={c.id} onClick={() => setSelected(c.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-0 bg-white hover:bg-gray-50 row-lift relative">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0">
                    {(c.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                  </div>
                  <CreditBadge balance={c.currentBalance} />
                </button>
              ))}
            </div>
          )
        ) : udhaar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <Users size={22} className="text-emerald-700" />
            </div>
            <p className="text-sm font-medium text-gray-900">No udhaar pending</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
              When a customer buys on credit, their balance shows here so you can follow up.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {udhaar.map(c => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <button onClick={() => setSelected(c.id)} className="w-full text-left row-lift">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm font-semibold tabular-nums text-amber-600">
                      &#8377;{c.currentBalance.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{ageLine(c)}</p>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPayFor(c)}
                    className="btn-lift inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    + Receive payment
                  </button>
                  <RemindButton
                    customerName={c.name}
                    phone={c.phone}
                    balance={c.currentBalance}
                    shopName={shop.name}
                    template={shop.reminderTemplate}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {payFor && (
        <ReceivePaymentSheet
          customerId={payFor.id}
          customerName={payFor.name}
          currentBalance={payFor.currentBalance}
          onClose={() => setPayFor(null)}
          onSaved={() => { setPayFor(null); load() }}
        />
      )}
    </div>
  )
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<ListPageSkeleton rows={5} />}>
      <CustomersInner />
    </Suspense>
  )
}
