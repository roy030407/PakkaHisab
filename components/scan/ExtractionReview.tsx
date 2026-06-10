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
  editedQty: number
  editedPrice: number
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
  onEditAll: () => void
}

export function ExtractionReview({ extraction, documentUploadId, duplicateWarning, onSave, onEditAll }: Props) {
  const [items, setItems] = useState<EditableItem[]>(
    extraction.items.map((item: ExtractionItem) => ({
      ...item,
      editedQty: item.quantity,
      editedPrice: item.unitPrice,
      originalQty: item.quantity,
      originalPrice: item.unitPrice,
    }))
  )
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

  async function handleSave() {
    setSaving(true)
    const payload = {
      documentUploadId,
      vendorName: extraction.vendorName,
      date: extraction.date,
      totalAmount: total,
      items: items.filter(i => i.editedQty > 0).map(item => {
        const correctedFields: Record<string, { original: string; corrected: string }> = {}
        if (item.editedQty !== item.originalQty) {
          correctedFields.quantity = { original: String(item.originalQty), corrected: String(item.editedQty) }
        }
        if (item.editedPrice !== item.originalPrice) {
          correctedFields.unit_price = { original: String(item.originalPrice), corrected: String(item.editedPrice) }
        }
        return {
          productNameRaw: item.productNameRaw,
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
      {/* Dark sticky header */}
      <div className="sticky top-0 z-10 bg-slate-900 px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {extraction.vendorName ?? 'Unknown vendor'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {extraction.date ?? 'Date not detected'}
            </p>
          </div>
          <button
            onClick={onEditAll}
            className="text-xs text-slate-400 border border-slate-600 rounded px-2 py-1 hover:border-slate-400"
          >
            Edit
          </button>
        </div>
        <p className="text-3xl font-bold text-white mt-2">
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
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.matchedProductName ?? item.productNameRaw}
                    </p>
                    {item.needsCatalogAdd && (
                      <p className="text-xs text-red-600 mt-0.5">
                        Not in catalog - will be added as new product
                      </p>
                    )}
                    {rowLowConf && (
                      <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                        <ConfidenceBadge level="medium" /> please check
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => adjustQty(idx, -1)}
                      className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm hover:bg-gray-200"
                      aria-label={`Decrease quantity for ${item.productNameRaw}`}
                    >
                      −
                    </button>
                    <span className="text-sm font-bold text-gray-900 min-w-[20px] text-center">
                      {item.editedQty}
                    </span>
                    <button
                      onClick={() => adjustQty(idx, 1)}
                      className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm hover:bg-slate-700"
                      aria-label={`Increase quantity for ${item.productNameRaw}`}
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-500 min-w-[48px] text-right">
                      ₹{item.editedPrice}
                    </span>
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
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-green-700"
        >
          {saving
            ? 'Saving...'
            : `Save purchase · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <button
          onClick={onEditAll}
          className="w-full text-center text-sm text-gray-500"
        >
          Edit all details
        </button>
      </div>
    </div>
  )
}
