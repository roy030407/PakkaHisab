/**
 * FILE: audit/tests/B-integrity.test.ts
 *
 * WHAT THIS DOES:
 *   Delete / void / edit integrity against the REAL route handlers
 *   (app/api/transactions/[id], entry/quick, inventory PATCH) with the
 *   in-memory Supabase fake. Each test asserts the correct ledger invariant:
 *     customer.current_balance == sum(credit sales) - sum(payments) over live rows
 *     inventory.current_stock  == opening + purchases - sales over live rows
 *   Failing tests are findings. Observed values print with prefix [B-INT].
 *
 * Run: npx vitest run --config audit/tests/B-vitest.config.ts B-integrity
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeDb, makeClient, jsonRequest } from './B-fakeSupabase'

let client: ReturnType<typeof makeClient>
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => client,
  createSupabaseServiceClient: () => client,
}))

import { POST as quickPOST } from '@/app/api/entry/quick/route'
import { DELETE as txDELETE, PATCH as txPATCH } from '@/app/api/transactions/[id]/route'
import { PATCH as invPATCH } from '@/app/api/inventory/route'

const U = 'user-1'
const S = 'store-1'
let db: FakeDb

const balance = (id = 'c1') => Number(db.rows('customers').find(c => c.id === id)!.current_balance)
const stock = () => Number(db.rows('inventory').find(i => i.product_id === 'p1')!.current_stock)
const ctx = (id: string) => ({ params: { id } })

async function creditSale(qty = 10, customerId = 'c1') {
  const r = await quickPOST(jsonRequest('/api/entry/quick', {
    type: 'sale', paymentMethod: 'credit', customerId, items: [{ productId: 'p1', quantity: qty }],
  }))
  return (await r.json()).transactionId as string
}

beforeEach(() => {
  db = new FakeDb({ seed: 11, maxLatencyMs: 2 })
  client = makeClient(db, U)
  db.seed('stores', [
    { id: S, owner_id: U, name: 'Audit B Store' },
    { id: 'store-2', owner_id: 'user-2', name: 'Other Store' },
  ])
  db.seed('products', [{ id: 'p1', store_id: S, item_number: 1, name: 'Parle-G', selling_price: 10, purchase_price: 8, tax_rate: 0, is_active: true }])
  db.seed('inventory', [{ id: 'inv1', store_id: S, product_id: 'p1', current_stock: 100, reorder_point: 0 }])
  db.seed('customers', [
    { id: 'c1', store_id: S, name: 'Sharma ji', current_balance: 0 },
    { id: 'c-other', store_id: 'store-2', name: 'Other store customer', current_balance: 0 },
  ])
})

describe('delete', () => {
  it('deleting a credit sale reverts stock and balance (baseline, expected to pass)', async () => {
    const id = await creditSale()
    expect(balance()).toBe(100)
    expect(stock()).toBe(90)
    await txDELETE(new Request('http://x'), ctx(id))
    expect(balance()).toBe(0)
    expect(stock()).toBe(100)
    expect(db.rows('transactions')).toHaveLength(0)
    expect(db.rows('stock_movements')).toHaveLength(0)
  })

  it('void then delete (Recent -> Void, then Customer ledger -> Delete) must reverse ONCE', async () => {
    const id = await creditSale()
    await txPATCH(jsonRequest(`/api/transactions/${id}`, { action: 'void' }, 'PATCH'), ctx(id))
    const afterVoid = { balance: balance(), stock: stock() }
    await txDELETE(new Request('http://x'), ctx(id))
    console.log(`[B-INT] void+delete: afterVoid=${JSON.stringify(afterVoid)} afterDelete balance=${balance()} stock=${stock()} expected balance=0 stock=100`)
    expect(balance()).toBe(0)
    expect(stock()).toBe(100)
  })

  it('double-tap Void (two concurrent PATCH void) must reverse ONCE', async () => {
    const id = await creditSale()
    const res = await Promise.all([0, 1].map(() =>
      txPATCH(jsonRequest(`/api/transactions/${id}`, { action: 'void' }, 'PATCH'), ctx(id))))
    console.log(`[B-INT] concurrent void: statuses=${res.map(r => r.status)} balance=${balance()} stock=${stock()} expected 0 / 100`)
    expect(balance()).toBe(0)
    expect(stock()).toBe(100)
  })

  it('deleting a manual stock adjustment must undo the adjustment', async () => {
    await invPATCH(jsonRequest('/api/inventory', { productId: 'p1', delta: 25, reason: 'recount' }, 'PATCH'))
    expect(stock()).toBe(125)
    const adj = db.rows('transactions')[0]
    console.log(`[B-INT] adjustment tx row: type=${adj.type} total=${adj.total_amount} source=${adj.source}`)
    await txDELETE(new Request('http://x'), ctx(adj.id as string))
    console.log(`[B-INT] after deleting adjustment tx: stock=${stock()} expected=100 movements=${db.rows('stock_movements').length}`)
    expect(stock()).toBe(100)
  })
})

describe('edit', () => {
  it('Cash/UPI toggle on a credit sale (PaymentToggle -> set_payment) must remove it from udhaar', async () => {
    const id = await creditSale()
    expect(balance()).toBe(100)
    await txPATCH(jsonRequest(`/api/transactions/${id}`, { action: 'set_payment', paymentMethod: 'cash' }, 'PATCH'), ctx(id))
    const tx = db.rows('transactions').find(t => t.id === id)!
    console.log(`[B-INT] credit->cash toggle: payment_method=${tx.payment_method} balance=${balance()} expected=0`)
    expect(balance()).toBe(0)
  })

  it('...and deleting it afterwards must leave balance at 0 (not stuck at +100)', async () => {
    const id = await creditSale()
    await txPATCH(jsonRequest(`/api/transactions/${id}`, { action: 'set_payment', paymentMethod: 'cash' }, 'PATCH'), ctx(id))
    await txDELETE(new Request('http://x'), ctx(id))
    console.log(`[B-INT] credit->cash then delete: balance=${balance()} expected=0`)
    expect(balance()).toBe(0)
  })

  it('set_payment on an already voided sale must be rejected', async () => {
    const id = await creditSale()
    await txPATCH(jsonRequest(`/api/transactions/${id}`, { action: 'void' }, 'PATCH'), ctx(id))
    const r = await txPATCH(jsonRequest(`/api/transactions/${id}`, { action: 'set_payment', paymentMethod: 'upi' }, 'PATCH'), ctx(id))
    console.log(`[B-INT] set_payment on voided: status=${r.status}`)
    expect(r.status).toBeGreaterThanOrEqual(400)
  })
})

describe('input validation on entry/quick', () => {
  it('negative quantity must be rejected (else a "sale" adds stock and reduces udhaar)', async () => {
    const r = await quickPOST(jsonRequest('/api/entry/quick', {
      type: 'sale', paymentMethod: 'credit', customerId: 'c1', items: [{ productId: 'p1', quantity: -5 }],
    }))
    console.log(`[B-INT] qty=-5 credit sale: status=${r.status} balance=${balance()} stock=${stock()}`)
    expect(r.status).toBe(400)
  })

  it('customerId from ANOTHER store must not be attached to my transaction', async () => {
    await creditSale(1, 'c-other')
    const tx = db.rows('transactions')[0]
    console.log(`[B-INT] foreign customer: tx.customer_id=${tx.customer_id} otherBalance=${balance('c-other')}`)
    expect(tx.customer_id).toBeNull()
  })

  it('a credit sale with no customer must be rejected (udhaar with nobody to collect from)', async () => {
    const r = await quickPOST(jsonRequest('/api/entry/quick', {
      type: 'sale', paymentMethod: 'credit', items: [{ productId: 'p1', quantity: 1 }],
    }))
    console.log(`[B-INT] credit sale without customer: status=${r.status}`)
    expect(r.status).toBe(400)
  })
})
