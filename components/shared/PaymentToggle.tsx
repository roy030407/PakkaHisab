/**
 * FILE: components/shared/PaymentToggle.tsx
 *
 * WHAT THIS DOES:
 *   Post-save payment method toggle. Shows for 3 seconds after a sale is saved.
 *   Default is cash. Tap UPI to switch. Auto-dismisses to cash if no tap.
 *   Calls PATCH /api/transactions/[id] with action: set_payment.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Used by DashboardQuickSale, QuickEntry, and any save flow.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/dashboard/DashboardQuickSale.tsx, components/entry/QuickEntry.tsx
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { track } from '@/lib/analytics/posthog'

interface Props {
  transactionId: string
  total: number
  onDone: () => void
}

export function PaymentToggle({ transactionId, total, onDone }: Props) {
  const [selected, setSelected] = useState<'cash' | 'upi'>('cash')
  const [dismissed, setDismissed] = useState(false)

  const dismiss = useCallback(() => {
    setDismissed(true)
    onDone()
  }, [onDone])

  useEffect(() => {
    const timer = setTimeout(dismiss, 4000)
    return () => clearTimeout(timer)
  }, [dismiss])

  async function pickUpi() {
    setSelected('upi')
    track('payment_toggled', { method: 'upi', transactionId })
    try {
      await fetch(`/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_payment', paymentMethod: 'upi' }),
      })
    } catch { /* best effort */ }
    setTimeout(dismiss, 600)
  }

  if (dismissed) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <p className="text-sm font-semibold text-emerald-900">
        Sale saved - &#8377;{Math.round(total).toLocaleString('en-IN')}
      </p>
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={dismiss}
          className={`btn-lift rounded-lg px-5 py-2.5 text-sm font-semibold cursor-pointer transition-colors ${
            selected === 'cash'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700'
          }`}
        >
          Cash
        </button>
        <button
          type="button"
          onClick={pickUpi}
          className={`btn-lift rounded-lg px-5 py-2.5 text-sm font-semibold cursor-pointer transition-colors ${
            selected === 'upi'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700'
          }`}
        >
          UPI
        </button>
      </div>
      <div className="h-1 rounded-full bg-emerald-200 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full animate-shrink" />
      </div>
    </div>
  )
}
