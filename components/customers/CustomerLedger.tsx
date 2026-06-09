/**
 * FILE: components/customers/CustomerLedger.tsx
 *
 * WHAT THIS DOES:
 *   Per-customer transaction list. Fetches from /api/customers/[id].
 *   Shows all transactions in reverse-chronological order with balance badge.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Opened by tapping a customer in the customers page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import { CreditBadge } from './CreditBadge'

interface Tx { id: string; date: string; type: string; total_amount: number; payment_method: string; created_at: string }
interface CustomerDetail { id: string; name: string; phone?: string; type: string; current_balance: number }

interface Props { customerId: string; onBack: () => void }

export function CustomerLedger({ customerId, onBack }: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${customerId}`)
      .then(r => r.json())
      .then(d => {
        setCustomer(d.customer)
        setTransactions(d.transactions ?? [])
        setLoading(false)
      })
  }, [customerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-slate-700" />
      </div>
    )
  }
  if (!customer) return null

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <button onClick={onBack} className="text-sm text-slate-600 mb-2">&larr; Back</button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{customer.name}</h2>
            {customer.phone && <p className="text-sm text-gray-400">{customer.phone}</p>}
          </div>
          <CreditBadge balance={customer.current_balance} />
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-gray-400">No transactions yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 capitalize">{tx.type}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    &nbsp;&middot;&nbsp;{tx.payment_method}
                  </p>
                </div>
                <p className={`text-sm font-semibold ${tx.type === 'sale' ? 'text-green-700' : 'text-gray-900'}`}>
                  {tx.type === 'sale' ? '+' : '-'}&#8377;{Number(tx.total_amount).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
