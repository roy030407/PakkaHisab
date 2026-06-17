/**
 * FILE: components/customers/CustomerLedger.tsx
 *
 * WHAT THIS DOES:
 *   Per-customer transaction list. Fetches from /api/customers/[id].
 *   Shows all transactions in reverse-chronological order with balance badge.
 *   Each row can be deleted (with confirm); delete reverses stock + balance via
 *   DELETE /api/transactions/[id], then the ledger refetches.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *   - Added per-row delete with a confirm dialog (native <dialog> top layer)
 *   - Slice A: payment rows render green; Receive payment + WhatsApp remind actions
 *   - Slice B1: compact WhatsApp receipt share on sale rows
 *
 * WHERE IT FITS:
 *   Opened by tapping a customer in the customers page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx ; DELETE app/api/transactions/[id]/route.ts
 */
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { CreditBadge } from './CreditBadge'
import { ReceivePaymentSheet } from './ReceivePaymentSheet'
import { RemindButton } from './RemindButton'
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'
import { ErrorState } from '@/components/shared/ErrorState'

interface Tx { id: string; date: string; type: string; total_amount: number; payment_method: string; created_at: string }
interface CustomerDetail { id: string; name: string; phone?: string; type: string; current_balance: number }

interface Props { customerId: string; onBack: () => void }

export function CustomerLedger({ customerId, onBack }: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<Tx | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [shop, setShop] = useState<{ name: string; reminderTemplate: string | null }>({ name: '', reminderTemplate: null })
  const [showPay, setShowPay] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetch(`/api/customers/${customerId}`)
      .then(r => r.json())
      .then(d => {
        setCustomer(d.customer)
        setTransactions(d.transactions ?? [])
        setLoading(false)
      })
      .catch(() => { setError('Could not load this customer. Please try again.'); setLoading(false) })
  }, [customerId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/stores')
      .then(r => r.json())
      .then(d => setShop({ name: d.store?.name ?? '', reminderTemplate: d.store?.reminder_template ?? null }))
      .catch(() => {})
  }, [])

  function askDelete(tx: Tx) {
    setPendingDelete(tx)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    if (deleting) return
    dialogRef.current?.close()
    setPendingDelete(null)
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      await fetch(`/api/transactions/${pendingDelete.id}`, { method: 'DELETE' })
      await load()
    } finally {
      setDeleting(false)
      dialogRef.current?.close()
      setPendingDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-700" />
      </div>
    )
  }
  if (!customer) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-4 border-b border-gray-200">
          <button onClick={onBack} className="text-sm text-emerald-700">&larr; Back</button>
        </div>
        <div className="px-4 py-16">
          <ErrorState message={error ?? 'Could not load this customer.'} onRetry={load} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <button onClick={onBack} className="text-sm text-emerald-700 mb-2">&larr; Back</button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{customer.name}</h2>
            {customer.phone && <p className="text-sm text-gray-400">{customer.phone}</p>}
          </div>
          <CreditBadge balance={customer.current_balance} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setShowPay(true)}
            className="btn-lift inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            + Receive payment
          </button>
          <RemindButton
            customerName={customer.name}
            phone={customer.phone}
            balance={Number(customer.current_balance)}
            shopName={shop.name}
            template={shop.reminderTemplate}
          />
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
              <div key={tx.id} className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 capitalize">{tx.type}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    &nbsp;&middot;&nbsp;{tx.payment_method}
                  </p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${tx.type === 'payment' ? 'text-emerald-700' : tx.type === 'sale' ? 'text-green-700' : 'text-gray-900'}`}>
                  {tx.type === 'payment'
                    ? `Payment received +₹${Number(tx.total_amount).toLocaleString('en-IN')}`
                    : `${tx.type === 'sale' ? '+' : '-'}₹${Number(tx.total_amount).toLocaleString('en-IN')}`}
                </p>
                {tx.type === 'sale' && (
                  <ShareReceiptButton transactionId={tx.id} shopName={shop.name} variant="compact" />
                )}
                <button
                  onClick={() => askDelete(tx)}
                  aria-label="Delete transaction"
                  className="btn-lift ml-1 text-gray-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPay && (
        <ReceivePaymentSheet
          customerId={customerId}
          customerName={customer.name}
          currentBalance={Number(customer.current_balance)}
          onClose={() => setShowPay(false)}
          onSaved={() => { setShowPay(false); load() }}
        />
      )}

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          const rect = dialogRef.current?.getBoundingClientRect()
          if (!rect) return
          const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
          if (!inside) closeDialog()
        }}
        onCancel={(e) => { if (deleting) e.preventDefault() }}
        className="m-auto w-full max-w-xs rounded-2xl border-0 bg-white p-5 shadow-xl backdrop:bg-black/40"
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h2 className="text-base font-bold text-gray-900">Delete this transaction?</h2>
        <p className="mt-1 text-sm text-gray-500">
          {pendingDelete
            ? `The ${pendingDelete.type} of ₹${Number(pendingDelete.total_amount).toLocaleString('en-IN')} will be removed. Stock and balance will be reversed. This cannot be undone.`
            : ''}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={closeDialog}
            disabled={deleting}
            className="btn-lift flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleting}
            className="btn-lift flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
