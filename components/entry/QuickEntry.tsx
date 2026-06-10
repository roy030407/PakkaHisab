/**
 * FILE: components/entry/QuickEntry.tsx
 *
 * WHAT THIS DOES:
 *   Full-width product list with +/- buttons. Type pill (Sale/Purchase/Expense).
 *   Running total in dark sticky bar. Optional customer via CustomerSheet.
 *   Save calls POST /api/entry/quick.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Default mode on /entry page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/entry/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import type { Product, TransactionType, PaymentMethod } from '@/types'
import { CustomerSheet } from './CustomerSheet'

interface LineItem { productId: string; productName: string; unitPrice: number; quantity: number }
interface Props {
  onSaved: () => void
  onSwitchFull: (items: LineItem[]) => void
}

export function QuickEntry({ onSaved, onSwitchFull }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [type, setType] = useState<TransactionType>('sale')
  const [qtys, setQtys] = useState<Map<string, number>>(new Map())
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [showCustomer, setShowCustomer] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  function getPrice(p: Product) {
    return type === 'sale' ? Number(p.sellingPrice) : Number(p.purchasePrice)
  }

  function adj(pid: string, d: number) {
    setQtys(prev => {
      const n = new Map(prev)
      const q = (n.get(pid) ?? 0) + d
      q <= 0 ? n.delete(pid) : n.set(pid, q)
      return n
    })
  }

  const total = products.reduce((s, p) => s + (qtys.get(p.id) ?? 0) * getPrice(p), 0)
  const itemCount = qtys.size

  async function handleSave() {
    if (itemCount === 0) return
    setSaving(true)
    await fetch('/api/entry/quick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, paymentMethod, customerId,
        items: Array.from(qtys.entries()).map(([productId, quantity]) => ({ productId, quantity })),
      }),
    })
    setSaving(false)
    onSaved()
  }

  function buildLineItems(): LineItem[] {
    return Array.from(qtys.entries()).map(([pid, qty]) => {
      const p = products.find(x => x.id === pid)!
      return { productId: pid, productName: p.name, unitPrice: getPrice(p), quantity: qty }
    })
  }

  const sorted = [...products].sort((a, b) =>
    (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || a.name.localeCompare(b.name)
  )

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky running total */}
      <div className="sticky top-0 z-10 bg-slate-900 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} added</p>
          <p className="text-xl font-bold text-white">&#8377;{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="flex gap-1 bg-white/10 rounded-lg p-1">
          {(['sale', 'purchase', 'expense'] as TransactionType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-2 py-1 rounded transition-colors ${type === t ? 'bg-white text-slate-900 font-semibold' : 'text-slate-400'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 px-4 py-2">
        {products.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-gray-400">No products yet — add some in Settings</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {sorted.map(p => {
              const qty = qtys.get(p.id) ?? 0
              const price = getPrice(p)
              return (
                <div key={p.id} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">&#8377;{price} each</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => adj(p.id, -1)} aria-label={`Decrease ${p.name}`}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${qty === 0 ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      &minus;
                    </button>
                    <span className={`text-sm font-bold min-w-[20px] text-center ${qty === 0 ? 'text-gray-300' : 'text-gray-900'}`}>{qty}</span>
                    <button onClick={() => adj(p.id, 1)} aria-label={`Increase ${p.name}`}
                      className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm hover:bg-slate-700">
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        {type === 'sale' && (
          <button onClick={() => setShowCustomer(true)} className="w-full text-sm text-slate-600 py-1">
            {customerId ? '&#10003; Customer added' : '+ Add customer (optional)'}
          </button>
        )}
        <button onClick={handleSave} disabled={saving || itemCount === 0}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-green-700">
          {saving ? 'Saving...' : `Save ${type} · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <button onClick={() => onSwitchFull(buildLineItems())} className="w-full text-center text-xs text-gray-400 py-1">
          Switch to full entry
        </button>
      </div>

      <CustomerSheet open={showCustomer} onClose={() => setShowCustomer(false)}
        onSelect={(id, pm) => { setCustomerId(id); setPaymentMethod(pm); setShowCustomer(false) }} />
    </div>
  )
}
