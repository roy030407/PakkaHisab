/**
 * FILE: app/(dashboard)/ledger/page.tsx
 *
 * WHAT THIS DOES:
 *   The week-one POC flow in one screen: the merchant photographs his existing
 *   handwritten ledger (bahi) page, the app parses the entries, and shows the
 *   list plus the day's total. No typing, no switching how he records - he keeps
 *   the paper book exactly as today and just takes a photo. View-only by design
 *   (summaries/saving come after the core flow has been used several times).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (OkCredit POC: capture ledger photo -> parsed entries -> day total)
 *
 * WHERE IT FITS:
 *   Route /ledger. Reached from the dashboard "Scan your khata" card. Reuses the
 *   existing scan pipeline (/api/scan) and the ScanUpload / ScanLoading UI.
 *
 * CALLED BY / IMPORTS FROM:
 *   dashboard "Scan your khata" card ; POST /api/scan ; ScanUpload, ScanLoading
 */
'use client'
import { useState } from 'react'
import { ScanUpload } from '@/components/scan/ScanUpload'
import { ScanLoading } from '@/components/scan/ScanLoading'
import type { ExtractionResult, ExtractionItem } from '@/types'

type State = 'idle' | 'loading' | 'result' | 'error'

interface Row {
  name: string
  amount: number
  included: boolean
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function LedgerPage() {
  const [state, setState] = useState<State>('idle')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setState('loading')
    setError('')
    try {
      const imageCompression = (await import('browser-image-compression')).default
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })
      const fd = new FormData()
      fd.append('file', compressed, file.name)

      const res = await fetch('/api/scan', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not read the page. Try a clearer, well-lit photo.')
        setState('error')
        return
      }
      const ex: ExtractionResult = data.extraction
      const parsed: Row[] = (ex.items ?? []).map((it: ExtractionItem) => ({
        name: (it.matchedProductName ?? it.productNameRaw ?? '').trim() || 'Entry',
        amount: Number(it.unitPrice) || Number(it.totalPrice) || 0,
        included: true,
      }))
      setRows(parsed)
      setState('result')
    } catch {
      setError('Could not process the photo. Please try again.')
      setState('error')
    }
  }

  const included = rows.filter(r => r.included)
  const dayTotal = included.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  function setAmount(i: number, v: string) {
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, amount: Number(v) || 0 } : r)))
  }
  function toggle(i: number) {
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, included: !r.included } : r)))
  }
  function reset() {
    setRows([])
    setError('')
    setState('idle')
  }

  if (state === 'loading') return <ScanLoading />

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <p className="text-base font-semibold text-red-700 mb-2">Could not read the page</p>
        <p className="text-sm text-gray-500 mb-6">{error}</p>
        <button onClick={reset} className="btn-lift bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-800">
          Take another photo
        </button>
      </div>
    )
  }

  if (state === 'result') {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Day total - the hero */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-5 text-white">
          <p className="text-xs text-emerald-200">Today&apos;s total from your ledger</p>
          <p className="text-3xl font-bold tabular-nums">{inr(dayTotal)}</p>
          <p className="mt-1 text-xs text-emerald-100/90">
            {included.length} {included.length === 1 ? 'entry' : 'entries'}
            {rows.length !== included.length ? ` · ${rows.length - included.length} removed` : ''}
          </p>
        </div>

        <div className="flex-1 px-4 py-3 pb-28">
          {rows.length === 0 ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-medium text-amber-800">No entries were read from this page.</p>
              <p className="text-xs text-amber-700 mt-1">Try a clearer, well-lit photo of the page.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {rows.map((row, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-0 ${row.included ? '' : 'opacity-40'}`}>
                  <button
                    onClick={() => toggle(i)}
                    aria-label={row.included ? 'Remove this entry' : 'Add this entry back'}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${row.included ? 'bg-emerald-700 border-emerald-700' : 'border-gray-300'}`}
                  >
                    {row.included && <span className="text-white text-xs leading-none">&#10003;</span>}
                  </button>
                  <p className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">{row.name}</p>
                  <div className="flex items-center rounded-lg border border-gray-200 px-2 py-1">
                    <span className="text-xs text-gray-400">&#8377;</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={e => setAmount(i, e.target.value)}
                      aria-label={`Amount for ${row.name}`}
                      className="w-20 bg-transparent text-right text-sm font-semibold text-gray-900 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-center text-xs text-gray-400">
            Tap an amount to fix a misread. Uncheck an entry to leave it out of the total.
          </p>
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100">
          <button onClick={reset} className="btn-lift w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-semibold text-white hover:bg-emerald-800">
            Scan another page
          </button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Scan your khata</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Photograph your ledger page - keep writing in your book as usual, then see the entries and the day&apos;s total.
        </p>
      </div>
      <div className="flex-1">
        <ScanUpload onFileSelected={handleFile} />
      </div>
    </div>
  )
}
