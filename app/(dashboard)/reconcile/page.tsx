/**
 * FILE: app/(dashboard)/reconcile/page.tsx
 *
 * WHAT THIS DOES:
 *   The end-of-day "Din ka hisab" close. Shows opening cash (carried forward,
 *   editable), cash in/out today, expected cash in the drawer, a counted-cash
 *   input, the live difference (tally / short / extra), and a separate UPI tally.
 *   Saving posts the close (server recomputes) and shows the confirmation.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice C cash reconciliation)
 *
 * WHERE IT FITS:
 *   Route /reconcile. Reached from the dashboard "Din ka hisab" card.
 *
 * CALLED BY / IMPORTS FROM:
 *   dashboard "Din ka hisab" card ; GET/POST /api/reconciliation
 */
'use client'
import { useState, useEffect } from 'react'

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

interface Position {
  date: string
  openingCash: number
  cashIn: number
  cashOut: number
  expectedCash: number
  upiTotal: number
  saved: { counted_cash: number; note: string | null } | null
}

export default function ReconcilePage() {
  const [pos, setPos] = useState<Position | null>(null)
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reconciliation')
      .then(r => r.json())
      .then((d: Position) => {
        setPos(d)
        setOpening(String(d.openingCash ?? 0))
        if (d.saved) {
          setCounted(String(d.saved.counted_cash))
          setNote(d.saved.note ?? '')
        }
        setLoading(false)
      })
      .catch(() => { setError('Could not load the day. Please try again.'); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-700" />
      </div>
    )
  }
  if (!pos) {
    return <div className="px-4 py-16 text-center text-sm text-gray-500">{error ?? 'Something went wrong.'}</div>
  }

  const openingNum = Number(opening) || 0
  const expected = openingNum + pos.cashIn - pos.cashOut
  const countedNum = Number(counted) || 0
  const diff = countedNum - expected
  const hasCount = counted.trim() !== ''

  async function save() {
    if (!pos) return
    if (!hasCount) { setError('Enter the counted cash.'); return }
    setSaving(true)
    setError(null)
    setSavedMsg(false)
    const res = await fetch('/api/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: pos.date, openingCash: openingNum, countedCash: countedNum, note: note.trim() || undefined }),
    })
    if (res.ok) {
      setSavedMsg(true)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to save.')
    }
    setSaving(false)
  }

  const diffTone = diff === 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-600' : 'text-amber-600'
  const diffLabel = diff === 0 ? 'Tally - sahi hai' : diff < 0 ? `Short by ${inr(Math.abs(diff))}` : `Extra ${inr(diff)}`

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Din ka hisab</h1>
        <p className="text-xs text-gray-400 mt-0.5">Close the day. Count the cash drawer and check it against the books.</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600">Opening cash (start of day)</label>
          <input
            type="number" inputMode="decimal" min="0" value={opening}
            onChange={e => setOpening(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cash in today</span>
            <span className="font-medium text-emerald-700 tabular-nums">+{inr(pos.cashIn)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cash out today</span>
            <span className="font-medium text-gray-900 tabular-nums">-{inr(pos.cashOut)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
            <span className="font-medium text-gray-900">Expected in drawer</span>
            <span className="font-bold text-gray-900 tabular-nums">{inr(expected)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600">Counted cash (what is actually in the drawer)</label>
          <input
            type="number" inputMode="decimal" min="0" value={counted}
            onChange={e => { setCounted(e.target.value); setSavedMsg(false) }}
            placeholder="0"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          {hasCount && (
            <p className={`text-sm font-semibold ${diffTone}`}>{diffLabel}</p>
          )}
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional) - e.g. gave ₹200 to delivery boy"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 flex justify-between text-sm">
          <span className="text-gray-500">UPI received today (not in drawer)</span>
          <span className="font-medium text-gray-900 tabular-nums">{inr(pos.upiTotal)}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMsg && <p className="text-sm font-medium text-emerald-700">Saved. Tomorrow opens with {inr(countedNum)}.</p>}

        <button
          onClick={save} disabled={saving || !hasCount}
          className="btn-lift w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {saving ? 'Saving...' : pos.saved ? 'Update close' : 'Close the day'}
        </button>
      </div>
    </div>
  )
}
