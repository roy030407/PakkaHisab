/**
 * FILE: components/scan/LedgerReview.tsx
 *
 * WHAT THIS DOES:
 *   Ledger-page confirm screen. Shows extracted transactions as a scrollable
 *   checklist. Unchecked rows are excluded. Merchant can edit date/amount inline.
 *   "Save X transactions" button at the bottom.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Shown when scan state = 'review' and documentType = 'ledger_page'.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/scan/page.tsx
 */
'use client'
import { useState } from 'react'
import type { ExtractionResult, ExtractionItem } from '@/types'

interface LedgerRow extends ExtractionItem {
  checked: boolean
  editedAmount: number
  editedDate: string
  editingAmount: boolean
  editingDate: boolean
}

interface Props {
  extraction: ExtractionResult
  documentUploadId: string
  onSave: (payload: {
    documentUploadId: string
    vendorName?: string
    date?: string
    totalAmount: number
    items: Array<{
      productNameRaw: string
      matchedProductId?: string
      needsCatalogAdd: boolean
      quantity: number
      unitPrice: number
      totalPrice: number
      taxRate?: number
    }>
  }) => void
}

export function LedgerReview({ extraction, documentUploadId, onSave }: Props) {
  const [rows, setRows] = useState<LedgerRow[]>(
    extraction.items.map(item => ({
      ...item,
      checked: true,
      editedAmount: item.unitPrice,
      editedDate: extraction.date ?? new Date().toISOString().split('T')[0],
      editingAmount: false,
      editingDate: false,
    }))
  )
  const [saving, setSaving] = useState(false)

  const checkedRows = rows.filter(r => r.checked)

  function toggleCheck(idx: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, checked: !r.checked } : r))
  }

  function setField<K extends keyof LedgerRow>(idx: number, key: K, value: LedgerRow[K]) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }

  async function handleSave() {
    setSaving(true)
    const totalAmount = checkedRows.reduce((s, r) => s + r.editedAmount, 0)
    onSave({
      documentUploadId,
      totalAmount,
      items: checkedRows.map(r => ({
        productNameRaw: r.productNameRaw,
        matchedProductId: r.matchedProductId,
        needsCatalogAdd: r.needsCatalogAdd,
        quantity: 1,
        unitPrice: r.editedAmount,
        totalPrice: r.editedAmount,
        taxRate: r.taxRate,
      })),
    })
    setSaving(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-emerald-700 px-4 py-4">
        <p className="text-sm text-emerald-200">Ledger page</p>
        <p className="text-xl font-bold text-white mt-0.5">
          {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} detected
        </p>
      </div>

      {/* Checklist */}
      <div className="flex-1 pb-32 px-4 py-3">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0 gap-3">
              {/* Checkbox */}
              <button
                onClick={() => toggleCheck(idx)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  row.checked ? 'bg-emerald-700 border-emerald-700' : 'border-gray-300'
                }`}>
                {row.checked && <span className="text-white text-xs leading-none">&#10003;</span>}
              </button>

              {/* Date (tap to edit) */}
              {row.editingDate ? (
                <input
                  type="date"
                  value={row.editedDate}
                  onChange={e => setField(idx, 'editedDate', e.target.value)}
                  onBlur={() => setField(idx, 'editingDate', false)}
                  autoFocus
                  className="text-xs border-b border-emerald-400 focus:outline-none bg-transparent w-24"
                />
              ) : (
                <button onClick={() => setField(idx, 'editingDate', true)}
                  className="text-xs text-gray-500 min-w-[72px]">
                  {new Date(row.editedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </button>
              )}

              {/* Party / description */}
              <p className="flex-1 text-sm font-medium text-gray-900 truncate min-w-0">
                {row.productNameRaw}
              </p>

              {/* Amount (tap to edit) */}
              {row.editingAmount ? (
                <input
                  type="number"
                  value={row.editedAmount}
                  onChange={e => setField(idx, 'editedAmount', Number(e.target.value))}
                  onBlur={() => setField(idx, 'editingAmount', false)}
                  autoFocus
                  className="text-sm font-semibold text-right border-b border-emerald-400 focus:outline-none bg-transparent w-20"
                />
              ) : (
                <button onClick={() => setField(idx, 'editingAmount', true)}
                  className="text-sm font-semibold text-gray-900 min-w-[60px] text-right">
                  &#8377;{row.editedAmount.toLocaleString('en-IN')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100">
        <button onClick={handleSave} disabled={saving || checkedRows.length === 0}
          className="w-full bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-emerald-800">
          {saving ? 'Saving...' : `Save ${checkedRows.length} transaction${checkedRows.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
