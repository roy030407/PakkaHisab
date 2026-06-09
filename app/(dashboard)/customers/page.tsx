/**
 * FILE: app/(dashboard)/customers/page.tsx
 *
 * WHAT THIS DOES:
 *   Searchable customer list. Tap a customer to open their ledger.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Route /customers. Accessible from BottomNav.
 *
 * CALLED BY / IMPORTS FROM:
 *   BottomNav
 */
'use client'
import { useState, useEffect } from 'react'
import type { Customer } from '@/types'
import { CreditBadge } from '@/components/customers/CreditBadge'
import { CustomerLedger } from '@/components/customers/CustomerLedger'

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
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      <div className="flex-1 px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-slate-700" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-gray-900">No customers yet</p>
            <p className="text-sm text-gray-400 mt-1">Customers are added when you record a transaction</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className="w-full text-left flex items-center px-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
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
