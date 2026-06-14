/**
 * FILE: components/scan/ExtractionReview.tsx
 *
 * WHAT THIS DOES:
 *   Single-bill confirm screen. Each row resolves to a catalog product through
 *   one of five states: matched, price-from-catalog (verify), variant chooser,
 *   quantity-vs-price toggle, and did-you-mean suggestions (with an explicit
 *   "Add as new" last resort). Rows can be removed. Save is blocked until every
 *   ambiguous row is resolved or removed.
 *
 * CHANGES THIS SESSION:
 *   - Rebuilt for hybrid matching: row states, variant/suggestion pills,
 *     qty/price toggle, per-row remove, save gating.
 *
 * WHERE IT FITS:
 *   Shown when scan state = 'review' and documentType = 'single_bill'.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/scan/page.tsx
 */
'use client'
import { useState } from 'react'
import type { ExtractionResult, ExtractionItem, MatchCandidate } from '@/types'
import { DuplicateWarning } from './DuplicateWarning'

type QtyPriceMode = 'unset' | 'quantity' | 'price'

interface EditableItem extends ExtractionItem {
  editedName: string
  editedQty: number
  editedPrice: number
  originalName: string
  addAsNew: boolean
  removed: boolean
  qtyPriceMode: QtyPriceMode
  bareNumber: number
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
      addAsNew: boolean
      quantity: number
      unitPrice: number
      totalPrice: number
      taxRate?: number
      correction?: { original: string; corrected: string }
    }>
  }) => void
}

export function ExtractionReview({ extraction, documentUploadId, duplicateWarning, onSave }: Props) {
  const [items, setItems] = useState<EditableItem[]>(
    extraction.items.map((item: ExtractionItem) => {
      const name = item.matchedProductName ?? item.productNameRaw
      const bareNumber = item.numberTokens?.find(t => t.guessedRole === 'unknown')?.value ?? 0
      return {
        ...item,
        editedName: name,
        editedQty: item.quantity,
        editedPrice: item.unitPrice,
        originalName: name,
        addAsNew: item.matchState === 'unmatched',
        removed: false,
        qtyPriceMode: 'unset',
        bareNumber,
      }
    })
  )
  const [vendorName, setVendorName] = useState(extraction.vendorName ?? '')
  const [date, setDate] = useState(extraction.date ?? '')
  const [showDuplicate, setShowDuplicate] = useState(!!duplicateWarning)
  const [saving, setSaving] = useState(false)

  const live = items.filter(i => !i.removed)
  const total = live.reduce((s, i) => s + i.editedQty * i.editedPrice, 0)

  function patch(idx: number, fn: (it: EditableItem) => EditableItem) {
    setItems(prev => prev.map((it, i) => (i === idx ? fn(it) : it)))
  }
  const adjustQty = (idx: number, delta: number) =>
    patch(idx, it => ({ ...it, editedQty: Math.max(0, it.editedQty + delta) }))
  const setPrice = (idx: number, v: string) =>
    patch(idx, it => ({ ...it, editedPrice: Math.max(0, Number(v) || 0) }))
  const setName = (idx: number, v: string) =>
    patch(idx, it => ({ ...it, editedName: v }))
  const removeRow = (idx: number) => patch(idx, it => ({ ...it, removed: true }))

  const chooseCandidate = (idx: number, c: MatchCandidate) =>
    patch(idx, it => ({
      ...it,
      matchedProductId: c.productId,
      matchedProductName: c.name,
      editedName: c.name,
      editedPrice: it.editedPrice > 0 ? it.editedPrice : c.unitPrice,
      matchState: 'matched',
      addAsNew: false,
      needsVerify: it.editedPrice > 0 ? it.needsVerify : true,
      fillSource: it.editedPrice > 0 ? it.fillSource : 'catalog',
    }))

  const markAddNew = (idx: number) =>
    patch(idx, it => ({ ...it, addAsNew: true, matchState: 'unmatched', matchedProductId: undefined }))

  const setQtyPriceMode = (idx: number, mode: QtyPriceMode) =>
    patch(idx, it => {
      if (mode === 'quantity') return { ...it, qtyPriceMode: mode, editedQty: it.bareNumber, ambiguousQtyPrice: false }
      if (mode === 'price') return { ...it, qtyPriceMode: mode, editedPrice: it.bareNumber, editedQty: it.editedQty || 1, ambiguousQtyPrice: false }
      return { ...it, qtyPriceMode: mode }
    })

  // Save is blocked while any live row is still unresolved.
  const unresolved = live.some(
    i => (i.matchState === 'variant_choice') || (i.ambiguousQtyPrice && i.qtyPriceMode === 'unset')
  )

  async function handleSave() {
    setSaving(true)
    const payload = {
      documentUploadId,
      vendorName: vendorName.trim() || undefined,
      date: date.trim() || undefined,
      totalAmount: total,
      items: live.filter(i => i.editedQty > 0).map(it => {
        const finalName = it.editedName.trim() || it.originalName
        return {
          productNameRaw: finalName,
          matchedProductId: it.addAsNew ? undefined : it.matchedProductId,
          addAsNew: it.addAsNew,
          quantity: it.editedQty,
          unitPrice: it.editedPrice,
          totalPrice: it.editedQty * it.editedPrice,
          taxRate: it.taxRate,
          // Learn the AI's raw read -> the product the merchant actually chose.
          correction: it.productNameRaw && finalName !== it.productNameRaw
            ? { original: it.productNameRaw, corrected: finalName }
            : undefined,
        }
      }),
    }
    onSave(payload)
    setSaving(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-emerald-700 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Vendor</label>
            <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Unknown vendor"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm font-semibold text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Date</label>
            <input value={date} onChange={e => setDate(e.target.value)} placeholder="Not detected"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
          </div>
        </div>
        <p className="text-3xl font-bold text-white mt-3">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      </div>

      <div className="flex-1 pb-32">
        {showDuplicate && duplicateWarning && (
          <DuplicateWarning date={duplicateWarning.date} onDismiss={() => setShowDuplicate(false)} />
        )}

        <div className="mx-4 mt-3 space-y-3">
          {items.map((item, idx) => {
            if (item.removed) return null
            const warn = item.needsVerify || item.matchState !== 'matched'
            return (
              <div key={idx} className={`rounded-xl border p-3 ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <input value={item.editedName} onChange={e => setName(idx, e.target.value)} aria-label="Product name"
                    className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-gray-900 outline-none hover:border-gray-200 focus:border-emerald-300 focus:bg-white" />
                  <button onClick={() => removeRow(idx)} aria-label="Remove item"
                    className="btn-lift text-gray-400 hover:text-red-600 px-1">✕</button>
                </div>

                {/* State chips / controls */}
                {item.matchState === 'matched' && !item.needsVerify && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">✓ matched</p>
                )}
                {item.matchState === 'matched' && item.needsVerify && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    ⚠ {item.fillSource === 'catalog' ? 'price filled from catalog' : 'please check'}
                  </p>
                )}

                {item.matchState === 'variant_choice' && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Which size?</p>
                    <div className="flex flex-wrap gap-2">
                      {item.candidates.map(c => (
                        <button key={c.productId} onClick={() => chooseCandidate(idx, c)}
                          className="btn-lift rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-emerald-400">
                          {c.sizeToken ? `${c.sizeToken} · ₹${c.unitPrice}` : `${c.name} · ₹${c.unitPrice}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {item.matchState === 'suggest' && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Did you mean:</p>
                    <div className="flex flex-wrap gap-2">
                      {item.candidates.map(c => (
                        <button key={c.productId} onClick={() => chooseCandidate(idx, c)}
                          className="btn-lift rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-emerald-400">
                          {c.name}
                        </button>
                      ))}
                      <button onClick={() => markAddNew(idx)}
                        className="btn-lift rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400">
                        + Add as new
                      </button>
                    </div>
                  </div>
                )}

                {item.matchState === 'unmatched' && (
                  <p className="mt-1 text-xs text-gray-500">Will be added as a new product.</p>
                )}

                {item.ambiguousQtyPrice && item.qtyPriceMode === 'unset' && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Is <b>{item.bareNumber}</b> the quantity or the price?</p>
                    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                      <button onClick={() => setQtyPriceMode(idx, 'quantity')} className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Quantity ({item.bareNumber})</button>
                      <button onClick={() => setQtyPriceMode(idx, 'price')} className="px-3 py-1.5 text-sm font-medium text-gray-700 border-l border-gray-300 hover:bg-gray-50">Price (₹{item.bareNumber})</button>
                    </div>
                  </div>
                )}

                {/* Price + qty steppers */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1">
                    <span className="text-xs text-gray-400">₹</span>
                    <input type="number" min="0" inputMode="decimal" value={item.editedPrice} onChange={e => setPrice(idx, e.target.value)} aria-label={`Price for ${item.editedName}`}
                      className="w-16 bg-transparent text-sm text-gray-900 outline-none" />
                    <span className="text-xs text-gray-400">each</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => adjustQty(idx, -1)} aria-label={`Decrease quantity for ${item.editedName}`}
                      className="btn-lift w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm hover:bg-gray-200">−</button>
                    <span className="text-sm font-bold text-gray-900 min-w-[20px] text-center">{item.editedQty}</span>
                    <button onClick={() => adjustQty(idx, 1)} aria-label={`Increase quantity for ${item.editedName}`}
                      className="btn-lift w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm hover:bg-emerald-800">+</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        <button onClick={handleSave} disabled={saving || unresolved || live.filter(i => i.editedQty > 0).length === 0}
          className="w-full bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-emerald-800">
          {saving ? 'Saving...' : unresolved ? 'Resolve highlighted items to save' : `Save purchase · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <p className="text-center text-xs text-gray-400">Tap any field above to fix it before saving.</p>
      </div>
    </div>
  )
}
