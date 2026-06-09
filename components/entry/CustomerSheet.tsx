/**
 * FILE: components/entry/CustomerSheet.tsx
 *
 * WHAT THIS DOES:
 *   Bottom sheet for attaching a customer to a transaction.
 *   Search existing, create new inline, toggle credit/cash.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Opened from QuickEntry and FullEntryForm footer.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/entry/QuickEntry.tsx, components/entry/FullEntryForm.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import type { Customer } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (customerId: string, paymentMethod: 'cash' | 'upi' | 'credit') => void
}

export function CustomerSheet({ open, onClose, onSelect }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [credit, setCredit] = useState(false)

  useEffect(() => {
    if (open) fetch('/api/customers').then(r => r.json()).then(d => setCustomers(d.customers ?? []))
  }, [open])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone ?? '').includes(query)
  )

  async function createAndSelect() {
    if (!name.trim()) return
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, type: 'walk_in' }),
    })
    const d = await res.json()
    if (res.ok) onSelect(d.customer.id, credit ? 'credit' : 'cash')
  }

  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl p-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Add customer</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">&times;</button>
        </div>
        <button onClick={() => setCredit(!credit)}
          className="flex items-center gap-2 mb-3 text-sm text-gray-700 self-start">
          <div className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${credit ? 'bg-slate-800 justify-end' : 'bg-gray-200 justify-start'}`}>
            <div className="w-4 h-4 rounded-full bg-white shadow" />
          </div>
          On credit (pay later)
        </button>
        {!creating ? (
          <>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customers..."
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <div className="flex-1 overflow-y-auto">
              {filtered.map(c => (
                <button key={c.id} onClick={() => onSelect(c.id, credit ? 'credit' : 'cash')}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                </button>
              ))}
              <button onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-700 font-medium">+ New customer</button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" type="tel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm">Back</button>
              <button onClick={createAndSelect} className="flex-1 bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium">Save &amp; select</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
