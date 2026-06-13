/**
 * FILE: components/scan/ExtractionReview.tsx
 *
 * WHAT THIS DOES:
 *   Single-bill confirm screen. Shows extracted items in a scrollable list
 *   with inline +/- quantity controls. Tracks merchant edits as corrections.
 *   Dark sticky header shows vendor + total. Save sends to /api/scan/confirm.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *   - Full inline editing: vendor, date, product name, price and quantity are
 *     all editable in place. Removed the "Edit all details" jump to /entry
 *     (it discarded the scanned data); everything is corrected right here.
 *
 * WHERE IT FITS:
 *   Shown when scan state = 'review' and documentType = 'single_bill'.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/scan/page.tsx
 */
'use client'
import { useState } from 'react'
import type { ExtractionResult, ExtractionItem } from '@/types'
import { ConfidenceBadge } from './ConfidenceBadge'
import { DuplicateWarning } from './DuplicateWarning'

interface EditableItem extends ExtractionItem {
  editedName: string
  editedQty: number
  editedPrice: number
  originalName: string
  originalQty: number
  originalPrice: number
}

interface Props {
  extraction: ExtractionResult
  documentUploadId: string
  duplicateWarning?: { date: string; id: string } | null
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
      correctedFields?: Record<string, { original: string; corrected: string }>
    }>
  }) => void
}

export function ExtractionReview({ extraction, documentUploadId, duplicateWarning, onSave }: Props) {
  const [items, setItems] = useState<EditableItem[]>(
    extraction.items.map((item: ExtractionItem) => {
      const name = item.matchedProductName ?? item.productNameRaw
      return {
        ...item,
        editedName: name,
        editedQty: item.quantity,
        editedPrice: item.unitPrice,
        originalName: name,
        originalQty: item.quantity,
        originalPrice: item.unitPrice,
      }
    })
  )
  const [vendorName, setVendorName] = useState(extraction.vendorName ?? '')
  const [date, setDate] = useState(extraction.date ?? '')
  const [showDuplicate, setShowDuplicate] = useState(!!duplicateWarning)
  const [saving, setSaving] = useState(false)

  const total = items.reduce((s, i) => s + i.editedQty * i.editedPrice, 0)
  const hasLowConfidence = extraction.confidence !== 'high'

  function adjustQty(idx: number, delta: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const newQty = Math.max(0, item.editedQty + delta)
      return { ...item, editedQty: newQty }
    }))
  }

  function setName(idx: number, value: string) {
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, editedName: value } : item)))
  }

  function setPrice(idx: number, value: string) {
    const n = Math.max(0, Number(value) || 0)
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, editedPrice: n } : item)))
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      documentUploadId,
      vendorName: vendorName.trim() || undefined,
      date: date.trim() || undefined,
      totalAmount: total,
      items: items.filter(i => i.editedQty > 0).map(item => {
        const correctedFields: Record<string, { original: string; corrected: string }> = {}
        const trimmedName = item.editedName.trim() || item.originalName
        if (trimmedName !== item.originalName) {
          correctedFields.product_name = { original: item.originalName, corrected: trimmedName }
        }
        if (item.editedQty !== item.originalQty) {
          correctedFields.quantity = { original: String(item.originalQty), corrected: String(item.editedQty) }
        }
        if (item.editedPrice !== item.originalPrice) {
          correctedFields.unit_price = { original: String(item.originalPrice), corrected: String(item.editedPrice) }
        }
        return {
          productNameRaw: trimmedName,
          matchedProductId: item.matchedProductId,
          needsCatalogAdd: item.needsCatalogAdd,
          quantity: item.editedQty,
          unitPrice: item.editedPrice,
          totalPrice: item.editedQty * item.editedPrice,
          taxRate: item.taxRate,
          ...(Object.keys(correctedFields).length > 0 ? { correctedFields } : {}),
        }
      }),
    }
    onSave(payload)
    setSaving(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Dark sticky header with editable vendor + date */}
      <div className="sticky top-0 z-10 bg-emerald-700 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Vendor</label>
            <input
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              placeholder="Unknown vendor"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm font-semibold text-white placeholder-emerald-300 outline-none focus:border-emerald-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Date</label>
            <input
              value={date}
              onChange={e => setDate(e.target.value)}
              placeholder="Not detected"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm text-white placeholder-emerald-300 outline-none focus:border-emerald-300"
            />
          </div>
        </div>
        <p className="text-3xl font-bold text-white mt-3">
          ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 pb-32">
        {/* Low confidence banner */}
        {hasLowConfidence && (
          <div className="mx-4 mt-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠ Some fields may be incorrect - review before saving.
            </p>
          </div>
        )}

        {/* Duplicate warning */}
        {showDuplicate && duplicateWarning && (
          <DuplicateWarning
            date={duplicateWarning.date}
            onDismiss={() => setShowDuplicate(false)}
          />
        )}

        {/* Items list */}
        <div className="mx-4 mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {items.map((item, idx) => {
            const rowLowConf =
              item.fieldConfidence.quantity !== 'high' ||
              item.fieldConfidence.unitPrice !== 'high'
            return (
              <div
                key={idx}
                className={`px-3 py-3 border-b border-gray-100 last:border-0 ${rowLowConf ? 'bg-amber-50' : ''}`}
              >
                <div className="space-y-2">
                  <input
                    value={item.editedName}
                    onChange={e => setName(idx, e.target.value)}
                    aria-label="Product name"
                    className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-gray-900 outline-none hover:border-gray-200 focus:border-emerald-300 focus:bg-white"
                  />
                  {item.needsCatalogAdd && (
                    <p className="text-xs text-red-600">
                      Not in catalog - will be added as new product
                    </p>
                  )}
                  {rowLowConf && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <ConfidenceBadge level="medium" /> please check
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1">
                      <span className="text-xs text-gray-400">₹</span>
                      <input
                        type="number" min="0" inputMode="decimal"
                        value={item.editedPrice}
                        onChange={e => setPrice(idx, e.target.value)}
                        aria-label={`Price for ${item.editedName}`}
                        className="w-16 bg-transparent text-sm text-gray-900 outline-none"
                      />
                      <span className="text-xs text-gray-400">each</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => adjustQty(idx, -1)}
                        className="btn-lift w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm hover:bg-gray-200"
                        aria-label={`Decrease quantity for ${item.editedName}`}
                      >
                        &minus;
                      </button>
                      <span className="text-sm font-bold text-gray-900 min-w-[20px] text-center">
                        {item.editedQty}
                      </span>
                      <button
                        onClick={() => adjustQty(idx, 1)}
                        className="btn-lift w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm hover:bg-emerald-800"
                        aria-label={`Increase quantity for ${item.editedName}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        <button
          onClick={handleSave}
          disabled={saving || items.filter(i => i.editedQty > 0).length === 0}
          className="w-full bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-emerald-800"
        >
          {saving
            ? 'Saving...'
            : `Save purchase · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <p className="text-center text-xs text-gray-400">
          Tap any field above to fix it before saving.
        </p>
      </div>
    </div>
  )
}
