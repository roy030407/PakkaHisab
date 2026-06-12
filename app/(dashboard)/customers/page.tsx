/**
 * FILE: app/(dashboard)/customers/page.tsx
 *
 * WHAT THIS DOES:
 *   Searchable customer list. Tap a customer to open their ledger.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Route /customers. Accessible from BottomNav.
 *
 * CALLED BY / IMPORTS FROM:
 *   BottomNav
 */
'use client'
import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import type { Customer } from '@/types'
import { CreditBadge } from '@/components/customers/CreditBadge'
import { CustomerLedger } from '@/components/customers/CustomerLedger'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json())
      .then(d => { setCustomers(d.customers ?? []); setLoading(false) })
  }, [])

  if (selected) {
    return <CustomerLedger customerId={selected} onBack={() => setSelected(null)} />
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone ?? '').includes(query)
  )

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Customers</h1>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>
      <div className="flex-1 px-4 py-3">
        {loading ? (
          <ListPageSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <Users size={22} className="text-emerald-700" />
            </div>
            <p className="text-sm font-medium text-gray-900">No customers yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
              Customers are added when you record a sale — they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className="w-full text-left flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                </div>
                <CreditBadge balance={c.currentBalance} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
