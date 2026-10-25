/**
 * FILE: audit/tests/B-balance-race.test.ts
 *
 * WHAT THIS DOES:
 *   Proves the read-modify-write races on customers.current_balance and
 *   inventory.current_stock by firing concurrent requests at the REAL route
 *   handlers. Only the Supabase client is swapped for the in-memory fake
 *   (B-fakeSupabase.ts), which yields between round-trips exactly like a
 *   network call does. Every assertion states the CORRECT invariant, so these
 *   tests FAIL today and should pass once the writes are made atomic
 *   (e.g. an RPC doing `update ... set current_balance = current_balance + $1`).
 *
 *   Observed numbers are printed with the prefix [B-RACE] for findings-B.md.
 *
 * Run: npx vitest run --config audit/tests/B-vitest.config.ts B-balance-race
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeDb, makeClient, jsonRequest } from './B-fakeSupabase'

let client: ReturnType<typeof makeClient>
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => client,
  createSupabaseServiceClient: () => client,
}))

import { POST as quickPOST } from '@/app/api/entry/quick/route'
import { POST as fullPOST } from '@/app/api/entry/full/route'
import { POST as scanConfirmPOST } from '@/app/api/scan/confirm/route'
import { POST as paymentPOST } from '@/app/api/customers/[id]/payment/route'
import { updateStock } from '@/lib/inventory/updateStock'

const U = 'user-1'
const S = 'store-1'
const N = 20

let db: FakeDb

function seedStore(opts: { balance?: number; stock?: number | null } = {}) {
  db.seed('stores', [{ id: S, owner_id: U, name: 'Audit B Store' }])
  db.seed('products', [{ id: 'p1', store_id: S, item_number: 1, name: 'Parle-G', selling_price: 10, purchase_price: 8, tax_rate: 0, is_active: true }])
  if (opts.stock !== null) db.seed('inventory', [{ id: 'inv1', store_id: S, product_id: 'p1', current_stock: opts.stock ?? 1000, reorder_point: 0 }])
  db.seed('customers', [{ id: 'c1', store_id: S, name: 'Sharma ji', current_balance: opts.balance ?? 0 }])
}

const balance = () => Number(db.rows('customers').find(c => c.id === 'c1')!.current_balance)
const stock = () => Number(db.rows('inventory').find(i => i.product_id === 'p1')?.current_stock)

beforeEach(() => {
  db = new FakeDb({ seed: 7, maxLatencyMs: 3 })
  client = makeClient(db, U)
})

describe('control: same requests fired SEQUENTIALLY are correct (proves the fake is not the bug)', () => {
  it(`entry/quick: ${N} sequential Rs10 credit sales -> balance Rs${N * 10}`, async () => {
    seedStore()
    for (let i = 0; i < N; i++) {
      await quickPOST(jsonRequest('/api/entry/quick', {
        type: 'sale', paymentMethod: 'credit', customerId: 'c1',
        items: [{ productId: 'p1', quantity: 1 }],
      }))
    }
    expect(balance()).toBe(N * 10)
    expect(stock()).toBe(1000 - N)
  })

  it(`payment: ${N} sequential Rs10 payments -> balance Rs${1000 - N * 10}`, async () => {
    seedStore({ balance: 1000 })
    for (let i = 0; i < N; i++) {
      await paymentPOST(jsonRequest('/api/customers/c1/payment', { amount: 10 }), { params: { id: 'c1' } })
    }
    expect(balance()).toBe(1000 - N * 10)
  })
})

describe('realistic: just TWO overlapping requests (double-tap, or sale on one phone + payment on another)', () => {
  it('2 concurrent Rs10 credit sales -> balance Rs20', async () => {
    seedStore()
    await Promise.all([0, 1].map(() => quickPOST(jsonRequest('/api/entry/quick', {
      type: 'sale', paymentMethod: 'credit', customerId: 'c1', items: [{ productId: 'p1', quantity: 1 }],
    }))))
    console.log(`[B-RACE] two overlapping credit sales: balance=${balance()} expected=20`)
    expect(balance()).toBe(20)
  })
})

describe('customers.current_balance under concurrency', () => {
  it(`entry/quick: ${N} concurrent Rs10 credit sales -> balance must be Rs${N * 10}`, async () => {
    seedStore()
    const res = await Promise.all(Array.from({ length: N }, () =>
      quickPOST(jsonRequest('/api/entry/quick', {
        type: 'sale', paymentMethod: 'credit', customerId: 'c1',
        items: [{ productId: 'p1', quantity: 1 }],
      }))
    ))
    const created = res.filter(r => r.status === 201).length
    const txSum = db.rows('transactions').reduce((s, t) => s + Number(t.total_amount), 0)
    console.log(`[B-RACE] quick credit: responses201=${created} txRows=${db.rows('transactions').length} txSum=${txSum} balance=${balance()} expected=${N * 10} stock=${stock()} expectedStock=${1000 - N}`)
    expect(created).toBe(N)
    expect(balance()).toBe(txSum)
    expect(stock()).toBe(1000 - N)
  })

  it(`entry/full: ${N} concurrent Rs10 credit sales -> balance must be Rs${N * 10}`, async () => {
    seedStore()
    await Promise.all(Array.from({ length: N }, () =>
      fullPOST(jsonRequest('/api/entry/full', {
        type: 'sale', paymentMethod: 'credit', customerId: 'c1', date: '2026-10-14',
        items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }],
      }))
    ))
    console.log(`[B-RACE] full credit: balance=${balance()} expected=${N * 10}`)
    expect(balance()).toBe(N * 10)
  })

  it(`scan/confirm: ${N} concurrent Rs10 credit sales -> balance must be Rs${N * 10}`, async () => {
    seedStore()
    const res = await Promise.all(Array.from({ length: N }, () =>
      scanConfirmPOST(jsonRequest('/api/scan/confirm', {
        documentUploadId: '', type: 'sale', paymentMethod: 'credit', customerId: 'c1',
        totalAmount: 10,
        items: [{ productNameRaw: 'Parle-G', matchedProductId: 'p1', addAsNew: false, quantity: 1, unitPrice: 10, totalPrice: 10 }],
      }))
    ))
    const created = res.filter(r => r.status === 201).length
    console.log(`[B-RACE] scan credit: responses201=${created} balance=${balance()} expected=${N * 10} stock=${stock()} expectedStock=${1000 - N}`)
    expect(balance()).toBe(N * 10)
    expect(stock()).toBe(1000 - N)
  })

  it(`customers/[id]/payment: ${N} concurrent Rs10 payments on Rs1000 -> balance must be Rs${1000 - N * 10}`, async () => {
    seedStore({ balance: 1000 })
    await Promise.all(Array.from({ length: N }, () =>
      paymentPOST(jsonRequest('/api/customers/c1/payment', { amount: 10, paymentMethod: 'cash' }), { params: { id: 'c1' } })
    ))
    const payments = db.rows('transactions').filter(t => t.type === 'payment').length
    console.log(`[B-RACE] payment: paymentRows=${payments} balance=${balance()} expected=${1000 - N * 10}`)
    expect(balance()).toBe(1000 - N * 10)
  })

  it('mixed: 10 credit sales + 10 payments at once -> net change must be 0', async () => {
    seedStore({ balance: 500 })
    await Promise.all(Array.from({ length: N }, (_, i) => i % 2 === 0
      ? quickPOST(jsonRequest('/api/entry/quick', { type: 'sale', paymentMethod: 'credit', customerId: 'c1', items: [{ productId: 'p1', quantity: 1 }] }))
      : paymentPOST(jsonRequest('/api/customers/c1/payment', { amount: 10 }), { params: { id: 'c1' } })
    ))
    console.log(`[B-RACE] mixed sale+payment: balance=${balance()} expected=500`)
    expect(balance()).toBe(500)
  })
})

describe('inventory.current_stock under concurrency (lib/inventory/updateStock.ts)', () => {
  it(`${N} concurrent updateStock(-1) -> stock must drop by ${N}`, async () => {
    seedStore({ stock: 100 })
    await Promise.all(Array.from({ length: N }, (_, i) =>
      updateStock(client as never, { storeId: S, productId: 'p1', delta: -1, transactionId: `t${i}`, movementType: 'sale', unitPrice: 10 })
    ))
    const movements = db.rows('stock_movements').length
    console.log(`[B-RACE] updateStock existing row: movements=${movements} stock=${stock()} expected=${100 - N}`)
    expect(stock()).toBe(100 - N)
  })

  it('first-ever stock for a product: 5 concurrent +10 purchases -> stock must be 50', async () => {
    seedStore({ stock: null })
    await Promise.all(Array.from({ length: 5 }, (_, i) =>
      updateStock(client as never, { storeId: S, productId: 'p1', delta: 10, transactionId: `t${i}`, movementType: 'purchase', unitPrice: 8 })
    ))
    const invRows = db.rows('inventory').filter(i => i.product_id === 'p1').length
    console.log(`[B-RACE] updateStock first insert: inventoryRows=${invRows} stock=${stock()} expected=50 movements=${db.rows('stock_movements').length}`)
    expect(stock()).toBe(50)
  })

  it('first-ever SALE of a product with no inventory row: stock must go to -qty, not 0', async () => {
    seedStore({ stock: null })
    await updateStock(client as never, { storeId: S, productId: 'p1', delta: -5, transactionId: 't1', movementType: 'sale', unitPrice: 10 })
    await updateStock(client as never, { storeId: S, productId: 'p1', delta: -5, transactionId: 't2', movementType: 'sale', unitPrice: 10 })
    console.log(`[B-RACE] first sale with no inventory row: stock=${stock()} expected=-10 (movements say -10)`)
    // Movements ledger says 10 units left the shelf; inventory should agree.
    expect(stock()).toBe(-10)
  })
})

describe('scan/confirm: several "add as new" lines in one bill', () => {
  it('3 new items on one bill -> 3 transaction_items must be saved', async () => {
    seedStore()
    const res = await scanConfirmPOST(jsonRequest('/api/scan/confirm', {
      documentUploadId: '', type: 'purchase', vendorName: 'Saini Traders', totalAmount: 300,
      items: [
        { productNameRaw: 'Maggi 70g', addAsNew: true, quantity: 10, unitPrice: 12, totalPrice: 120 },
        { productNameRaw: 'Tata Salt 1kg', addAsNew: true, quantity: 5, unitPrice: 20, totalPrice: 100 },
        { productNameRaw: 'Surf Excel 500g', addAsNew: true, quantity: 1, unitPrice: 80, totalPrice: 80 },
      ],
    }))
    const items = db.rows('transaction_items').length
    const tx = db.rows('transactions')[0]
    console.log(`[B-RACE] scan add-as-new x3: status=${res.status} productsCreated=${db.rows('products').length - 1} transactionItems=${items} expected=3 tx.total_amount=${tx?.total_amount}`)
    expect(items).toBe(3)
  })
})
