/**
 * FILE: components/entry/FullEntryForm.tsx
 *
 * WHAT THIS DOES:
 *   Full transaction form. Product search, quantity stepper, price override,
 *   date picker, customer/vendor, payment method, notes.
 *   Save calls POST /api/entry/full.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Bug fix: updated p.sellingPrice/p.purchasePrice to snake_case
 *   - Khata Green restyle
 *   - Slice B1: after a sale saves, offer a WhatsApp receipt share
 *
 * WHERE IT FITS:
 *   "Full entry" mode on /entry page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/entry/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { Product, TransactionType, PaymentMethod, FullEntryItem } from '@/types'
import { ProductSearch } from './ProductSearch'
import { CustomerSheet } from './CustomerSheet'
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'

interface LineItem extends FullEntryItem { productName: string }
interface Props {
  initialItems?: LineItem[]
  onSaved: () => void
  onSwitchQuick: () => void
}

export function FullEntryForm({ initialItems, onSaved, onSwitchQuick }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<LineItem[]>(initialItems ?? [])
  const [type, setType] = useState<TransactionType>('sale')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [vendorName, setVendorName] = useState('')
  const [notes, setNotes] = useState('')
  const [showCustomer, setShowCustomer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shopName, setShopName] = useState('')
  const [savedSale, setSavedSale] = useState<{ id: string; total: number } | null>(null)

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setShopName(d.store?.name ?? '')).catch(() => {})
  }, [])

  function addProduct(p: Product) {
    const price = type === 'sale' ? Number(p.selling_price) : Number(p.purchase_price)
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === p.id)
      if (idx >= 0) return prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: price }]
    })
  }

  function removeItem(i: number) { setItems(prev => prev.filter((_, j) => j !== i)) }
  function updateQty(i: number, qty: number) {
    if (qty <= 0) removeItem(i)
    else setItems(prev => prev.map((it, j) => j === i ? { ...it, quantity: qty } : it))
  }
  function updatePrice(i: number, price: number) {
    setItems(prev => prev.map((it, j) => j === i ? { ...it, unitPrice: price } : it))
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const pmOptions: PaymentMethod[] = ['cash', 'upi', 'credit']

  async function handleSave() {
    if (!items.length) return
    setSaving(true)
    const res = await fetch('/api/entry/full', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, type, paymentMethod, customerId,
        vendorName: vendorName || undefined,
        notes: notes || undefined,
        items,
      }),
    })
    setSaving(false)
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} saved`)
    const data = await res.json().catch(() => ({}))
    if (type === 'sale' && data?.transactionId) {
      setSavedSale({ id: data.transactionId, total })
    } else {
      onSaved()
    }
  }

  if (savedSale) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
          &#10003;
        </div>
        <p className="text-lg font-semibold text-gray-900">Sale saved</p>
        <p className="mt-1 text-sm text-gray-500">
          &#8377;{savedSale.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          <ShareReceiptButton transactionId={savedSale.id} shopName={shopName} variant="prominent" />
          <button
            onClick={() => { setSavedSale(null); onSaved() }}
            className="btn-lift w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky total */}
      <div className="sticky top-0 z-10 bg-emerald-700 px-4 py-3">
        <p className="text-xs text-emerald-200">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        <p className="text-xl font-bold text-white">&#8377;{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      </div>

      <div className="flex-1 px-4 py-3 space-y-3">
        {/* Type + date */}
        <div className="flex gap-2">
          <select value={type} onChange={e => setType(e.target.value as TransactionType)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
        </div>

        {/* Product search */}
        <ProductSearch products={products} onSelect={addProduct} placeholder="Add product..." />

        {/* Item list */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {items.map((item, i) => (
              <div key={i} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateQty(i, item.quantity - 1)}
                      className="w-6 h-6 rounded-full bg-gray-100 text-sm text-gray-600 flex items-center justify-center">&minus;</button>
                    <span className="text-sm font-bold text-gray-900 min-w-[20px] text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(i, item.quantity + 1)}
                      className="w-6 h-6 rounded-full bg-gray-100 text-sm text-gray-600 flex items-center justify-center">+</button>
                    <span className="text-xs text-gray-400 ml-1">&times; &#8377;</span>
                    <input type="number" value={item.unitPrice}
                      onChange={e => updatePrice(i, Number(e.target.value))}
                      className="w-20 border-b border-gray-200 text-sm text-gray-900 focus:outline-none px-1" />
                  </div>
                </div>
                <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">&times;</button>
              </div>
            ))}
          </div>
        )}

        {/* Vendor or customer */}
        {(type === 'purchase' || type === 'expense')
          ? <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor name (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
          : <button onClick={() => setShowCustomer(true)}
              className="w-full text-left text-sm text-emerald-700 border border-gray-200 rounded-lg px-3 py-2 bg-white">
              {customerId ? '&#10003; Customer selected' : '+ Add customer (optional)'}
            </button>
        }

        {/* Payment method */}
        <div className="flex gap-2">
          {pmOptions.map(pm => (
            <button key={pm} onClick={() => setPaymentMethod(pm)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === pm ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-600 border-gray-200'}`}>
              {pm.charAt(0).toUpperCase() + pm.slice(1)}
            </button>
          ))}
        </div>

        {/* Notes */}
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
      </div>

      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        <button onClick={handleSave} disabled={saving || items.length === 0}
          className="w-full bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-emerald-800">
          {saving ? 'Saving...' : `Save ${type} · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <button onClick={onSwitchQuick} className="w-full text-center text-xs text-gray-400 py-1">Switch to quick entry</button>
      </div>

      <CustomerSheet open={showCustomer} onClose={() => setShowCustomer(false)}
        onSelect={(id, pm) => { setCustomerId(id); setPaymentMethod(pm); setShowCustomer(false) }} />
    </div>
  )
}
