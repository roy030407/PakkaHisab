/**
 * FILE: components/customers/ReceivePaymentSheet.tsx
 *
 * WHAT THIS DOES:
 *   Bottom-sheet form to record a customer repayment. Full/Half/Custom amount
 *   chips, optional date (default today) and note. POSTs to
 *   /api/customers/[id]/payment and reports the new balance to the parent.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Opened from the Customers udhaar tab and the customer ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx, components/customers/CustomerLedger.tsx
 */
'use client'
import { useState } from 'react'

interface Props {
  customerId: string
  customerName: string
  currentBalance: number
  onClose: () => void
  onSaved: (newBalance: number) => void
}

export function ReceivePaymentSheet({ customerId, customerName, currentBalance, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setChip(kind: 'full' | 'half') {
    const base = Math.max(0, currentBalance)
    setAmount(String(kind === 'full' ? base : Math.round(base / 2)))
  }

  async function save() {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    let res: Response
    try {
      res = await fetch(`/api/customers/${customerId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: n, date, note: note.trim() || undefined }),
      })
    } catch {
      setError('Could not save - check your connection and try again.')
      setSaving(false)
      return
    }
    if (res.ok) {
      const d = await res.json()
      onSaved(Number(d.newBalance))
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to record payment.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-gray-900">Receive payment</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          From {customerName} &middot; balance &#8377;{Math.max(0, currentBalance).toLocaleString('en-IN')}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setChip('full')}
            className="btn-lift flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-medium text-emerald-800"
          >
            Full
          </button>
          <button
            onClick={() => setChip('half')}
            className="btn-lift flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-medium text-emerald-800"
          >
            Half
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-gray-600">Amount (&#8377;)</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. UPI"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-400">Cash in - not counted as a sale/profit.</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-lift flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-lift flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
