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
 *   - Bug fix: updated p.sellingPrice/p.purchasePrice/p.isPinned to snake_case to
 *     match the Supabase response (was producing ₹NaN on every product)
 *   - Khata Green restyle
 *   - Sale-first UX: Sale is the default; Purchase/Expense tuck behind a
 *     "Recording something else?" toggle. Hover lift on action buttons.
 *   - Expense is no longer a product list: it shows an amount + category +
 *     note form (rent, electricity, etc. are not catalog products).
 *   - Slice B1: after a sale saves, offer a WhatsApp receipt share
 *
 * WHERE IT FITS:
 *   Default mode on /entry page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/entry/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { Product, TransactionType, PaymentMethod } from '@/types'
import { CustomerSheet } from './CustomerSheet'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'

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
  const [showTypeOptions, setShowTypeOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shopName, setShopName] = useState('')
  const [savedSale, setSavedSale] = useState<{ id: string; total: number } | null>(null)

  // Expense form state (only used when type === 'expense')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('rent')
  const [expenseNote, setExpenseNote] = useState('')

  const isExpense = type === 'expense'

  const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
    { value: 'rent', label: 'Rent' },
    { value: 'salaries', label: 'Salaries' },
    { value: 'electricity', label: 'Electricity' },
    { value: 'transport', label: 'Transport' },
    { value: 'other', label: 'Other' },
  ]

  const TYPE_META: Record<TransactionType, { label: string; hint: string }> = {
    sale: { label: 'Sale', hint: 'selling to a customer' },
    purchase: { label: 'Purchase', hint: 'buying stock' },
    expense: { label: 'Expense', hint: 'a cost, no stock' },
    income: { label: 'Income', hint: 'other money in' },
    payment: { label: 'Payment', hint: 'customer paying off credit' },
  }

  function chooseType(t: TransactionType) {
    setType(t)
    if (t === 'sale') setShowTypeOptions(false)
  }

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setShopName(d.store?.name ?? '')).catch(() => {})
  }, [])

  function getPrice(p: Product) {
    return type === 'sale' ? Number(p.selling_price) : Number(p.purchase_price)
  }

  function adj(pid: string, d: number) {
    setQtys(prev => {
      const n = new Map(prev)
      const q = (n.get(pid) ?? 0) + d
      if (q <= 0) { n.delete(pid) } else { n.set(pid, q) }
      return n
    })
  }

  const productTotal = products.reduce((s, p) => s + (qtys.get(p.id) ?? 0) * getPrice(p), 0)
  const itemCount = qtys.size
  const expenseValue = Number(expenseAmount) || 0
  const total = isExpense ? expenseValue : productTotal
  const canSave = isExpense ? expenseValue > 0 : itemCount > 0

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const body = isExpense
      ? { type, paymentMethod: 'cash', amount: expenseValue, category: expenseCategory, note: expenseNote.trim() || undefined }
      : {
          type, paymentMethod, customerId,
          items: Array.from(qtys.entries()).map(([productId, quantity]) => ({ productId, quantity })),
        }
    const res = await fetch('/api/entry/quick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    toast.success(`${TYPE_META[type].label} saved`)
    const data = await res.json().catch(() => ({}))
    if (type === 'sale' && data?.transactionId) {
      setSavedSale({ id: data.transactionId, total })
    } else {
      onSaved()
    }
  }

  function buildLineItems(): LineItem[] {
    return Array.from(qtys.entries()).map(([pid, qty]) => {
      const p = products.find(x => x.id === pid)!
      return { productId: pid, productName: p.name, unitPrice: getPrice(p), quantity: qty }
    })
  }

  const sorted = [...products].sort((a, b) =>
    (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || a.name.localeCompare(b.name)
  )

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
      {/* Sticky running total */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200/60 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-emerald-200">
            {isExpense ? 'One-time cost' : `${itemCount} item${itemCount !== 1 ? 's' : ''} added`}
          </p>
          <p className="text-xl font-bold text-white">
            <AnimatedNumber value={total} format={(n) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {showTypeOptions || type !== 'sale' ? (
            <>
              <div className="flex gap-1 bg-white/10 rounded-lg p-1">
                {(['sale', 'purchase', 'expense'] as TransactionType[]).map(t => (
                  <button key={t} onClick={() => chooseType(t)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${type === t ? 'bg-white text-emerald-800 font-semibold shadow-sm' : 'text-emerald-100 hover:text-white'}`}>
                    {TYPE_META[t].label}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-emerald-100/80">{TYPE_META[type].hint}</span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold bg-white text-emerald-800 px-3 py-1 rounded-lg shadow-sm">Sale</span>
              <button onClick={() => setShowTypeOptions(true)}
                className="text-[10px] text-emerald-100/90 hover:text-white underline-offset-2 hover:underline">
                Recording something else?
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expense form (no products) */}
      {isExpense ? (
        <div className="flex-1 px-4 py-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500">Amount</label>
              <div className="mt-1 flex items-center rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-emerald-300">
                <span className="pl-3 pr-1 text-gray-500">&#8377;</span>
                <input
                  type="number" min="0" inputMode="decimal" autoFocus
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent px-2 py-2.5 text-base font-semibold text-gray-900 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Category</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setExpenseCategory(c.value)}
                    className={`btn-lift rounded-full px-3.5 py-1.5 text-sm font-medium border ${
                      expenseCategory === c.value
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Note (optional)</label>
              <input
                type="text"
                value={expenseNote}
                onChange={e => setExpenseNote(e.target.value)}
                placeholder="e.g. June shop rent"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Product list */}
      <div className="flex-1 px-4 py-2">
        {products.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-gray-400">No products yet - add some in Settings</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {sorted.map(p => {
              const qty = qtys.get(p.id) ?? 0
              const price = getPrice(p)
              return (
                <div key={p.id} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0 card-lift">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">&#8377;{price} each</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => adj(p.id, -1)} aria-label={`Decrease ${p.name}`}
                      className={`btn-lift w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${qty === 0 ? 'bg-emerald-50 text-emerald-300' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                      &minus;
                    </button>
                    <span className={`text-sm font-bold min-w-[20px] text-center ${qty === 0 ? 'text-gray-300' : 'text-gray-900'}`}>{qty}</span>
                    <button onClick={() => adj(p.id, 1)} aria-label={`Increase ${p.name}`}
                      className="btn-lift w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm hover:bg-emerald-800">
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        {type === 'sale' && (
          <button onClick={() => setShowCustomer(true)}
            className="btn-lift w-full text-sm text-emerald-700 py-2 rounded-lg hover:bg-emerald-50">
            {customerId ? '✓ Customer added' : '+ Add customer (optional)'}
          </button>
        )}
        <button onClick={handleSave} disabled={saving || !canSave}
          className="btn-lift w-full bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-emerald-800">
          {saving ? 'Saving...' : `Save ${TYPE_META[type].label.toLowerCase()} · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        {!isExpense && (
          <button onClick={() => onSwitchFull(buildLineItems())}
            className="btn-lift w-full text-center text-xs text-gray-500 py-2 rounded-lg hover:bg-gray-100 hover:text-gray-700">
            Switch to full entry
          </button>
        )}
      </div>

      <CustomerSheet open={showCustomer} onClose={() => setShowCustomer(false)}
        onSelect={(id, pm) => { setCustomerId(id); setPaymentMethod(pm); setShowCustomer(false) }} />
    </div>
  )
}
