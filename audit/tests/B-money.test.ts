/**
 * FILE: audit/tests/B-money.test.ts
 *
 * WHAT THIS DOES:
 *   Money correctness for lib/reports (profit, cashReconciliation, tax,
 *   periods, buildReport) and the routes that feed them, against a
 *   hand-computed fixture day. Every expected number is worked out by hand in
 *   the comment next to it. Failing tests are findings ([B-MONEY] logs).
 *
 * FIXTURE DAY: Wed 2026-10-14 (IST), store "Audit B Store"
 *   opening cash (yesterday's counted close)            1000.00
 *   T1 cash sale                                          250.50
 *   T2 UPI sale                                           199.99
 *   T3 udhaar (credit) sale to Sharma ji                  500.00
 *   T4 Sharma ji part-pays udhaar in cash                 200.00  (type payment)
 *   T5 cash purchase of stock                             300.00
 *   T6 cash expense (bijli)                                50.00
 *   Fixed cost: rent 15000/month, override for 2026-10 = 18000
 *
 *   Hand calc:
 *     cash in   = 250.50 + 200.00                       =  450.50
 *     cash out  = 300.00 + 50.00                        =  350.00
 *     expected drawer = 1000 + 450.50 - 350             = 1100.50
 *     UPI       = 199.99
 *     sales     = 250.50 + 199.99 + 500                 =  950.49
 *     gross     = 950.49 - 300                          =  650.49
 *     fixed/day = 18000 / 30 (spec 4e: daily = monthly/30) = 600.00
 *     net       = 650.49 - 600 - 50                     =    0.49
 *     udhaar outstanding for Sharma ji = 500 - 200      =  300.00
 *
 * Run: npx vitest run --config audit/tests/B-vitest.config.ts B-money
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FakeDb, makeClient, jsonRequest } from './B-fakeSupabase'

let client: ReturnType<typeof makeClient>
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => client,
  createSupabaseServiceClient: () => client,
}))

import { computeCashPosition, cashDifference } from '@/lib/reports/cashReconciliation'
import { calculateProfit } from '@/lib/reports/profit'
import { buildPeriodReport } from '@/lib/reports/buildReport'
import { getPeriodBounds } from '@/lib/reports/periods'
import { GET as reconGET } from '@/app/api/reconciliation/route'
import { POST as quickPOST } from '@/app/api/entry/quick/route'
import { POST as scanConfirmPOST } from '@/app/api/scan/confirm/route'
import { GET as weeklyCronGET } from '@/app/api/cron/weekly-report/route'

const U = 'user-1'
const S = 'store-1'
let db: FakeDb
const ORIGINAL_TZ = process.env.TZ

function at(isoUtc: string, tz: string) {
  process.env.TZ = tz
  vi.setSystemTime(new Date(isoUtc))
}

function seedBase() {
  db.seed('stores', [{ id: S, owner_id: U, name: 'Audit B Store', created_at: '2026-01-01T00:00:00Z' }])
  db.seed('products', [
    { id: 'p1', store_id: S, item_number: 1, name: 'Parle-G', selling_price: 10, purchase_price: 8, tax_rate: 0, is_active: true },
    { id: 'p18', store_id: S, item_number: 2, name: 'Colgate 100g', selling_price: 118, purchase_price: 90, tax_rate: 18, is_active: true },
  ])
  db.seed('inventory', [{ id: 'inv1', store_id: S, product_id: 'p1', current_stock: 1000, reorder_point: 0 }])
  db.seed('customers', [{ id: 'c1', store_id: S, name: 'Sharma ji', current_balance: 300 }])
}

const tx = (date: string, type: string, payment_method: string | null, total_amount: number, extra: Record<string, unknown> = {}) =>
  ({ store_id: S, user_id: U, date, type, payment_method, total_amount, tax_amount: 0, source: 'manual_quick', voided_at: null, notes: null, ...extra })

function seedFixtureDay(date = '2026-10-14') {
  db.seed('transactions', [
    tx(date, 'sale', 'cash', 250.5),
    tx(date, 'sale', 'upi', 199.99),
    tx(date, 'sale', 'credit', 500, { customer_id: 'c1' }),
    tx(date, 'payment', 'cash', 200, { customer_id: 'c1' }),
    tx(date, 'purchase', 'cash', 300),
    tx(date, 'expense', 'cash', 50, { notes: 'electricity - bijli' }),
  ])
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  db = new FakeDb({ seed: 3, maxLatencyMs: 0 })
  client = makeClient(db, U)
})
afterEach(() => {
  vi.useRealTimers()
  process.env.TZ = ORIGINAL_TZ
})

describe('cash reconciliation (pure)', () => {
  it('fixture day: expected drawer 1100.50, UPI 199.99', () => {
    const r = computeCashPosition({
      openingCash: 1000,
      transactions: [
        { type: 'sale', paymentMethod: 'cash', totalAmount: 250.5 },
        { type: 'sale', paymentMethod: 'upi', totalAmount: 199.99 },
        { type: 'sale', paymentMethod: 'credit', totalAmount: 500 },
        { type: 'payment', paymentMethod: 'cash', totalAmount: 200 },
        { type: 'purchase', paymentMethod: 'cash', totalAmount: 300 },
        { type: 'expense', paymentMethod: 'cash', totalAmount: 50 },
      ],
    })
    expect(r.cashIn).toBe(450.5)
    expect(r.cashOut).toBe(350)
    expect(r.expectedCash).toBe(1100.5)
    expect(r.upiTotal).toBe(199.99)
  })

  it('paise: three Rs33.30 cash sales, drawer counted Rs99.90 -> difference must be exactly 0 ("Tally")', () => {
    const r = computeCashPosition({
      openingCash: 0,
      transactions: [33.3, 33.3, 33.3].map(a => ({ type: 'sale', paymentMethod: 'cash', totalAmount: a })),
    })
    const diff = cashDifference(99.9, r.expectedCash)
    console.log(`[B-MONEY] paise float: expectedCash=${r.expectedCash} diff=${diff} (UI shows "Tally" only when diff === 0)`)
    expect(diff).toBe(0)
  })

  it('paise: opening 1000 + Rs0.10 + Rs0.20 cash sales, counted 1000.30 -> difference 0', () => {
    const r = computeCashPosition({
      openingCash: 1000,
      transactions: [0.1, 0.2].map(a => ({ type: 'sale', paymentMethod: 'cash', totalAmount: a })),
    })
    const diff = cashDifference(1000.3, r.expectedCash)
    console.log(`[B-MONEY] paise float 2: expectedCash=${r.expectedCash} diff=${diff}`)
    expect(diff).toBe(0)
  })
})

describe('profit rounding (pure, property style)', () => {
  it('displayed net profit always equals displayed sales - purchases - fixed - expenses', () => {
    // Deterministic sweep over paise-valued inputs.
    let s = 12345
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
    const paise = (max: number) => Math.round(rnd() * max * 100) / 100
    let firstBad: unknown = null
    let bad = 0
    for (let i = 0; i < 5000; i++) {
      const p = calculateProfit(paise(5000), paise(3000), paise(800), paise(300))
      const recomposed = p.sales - p.purchases - p.fixedCosts - p.expenses
      if (recomposed !== p.netProfit) { bad++; firstBad ??= p }
    }
    console.log(`[B-MONEY] profit rounding: ${bad}/5000 cases where card math does not add up. first=${JSON.stringify(firstBad)}`)
    expect(bad).toBe(0)
  })
})

describe('buildPeriodReport against the fixture day (server TZ=UTC, like Vercel)', () => {
  it('daily report at 12:00 IST: sales/purchases/expenses/fixed/net', async () => {
    at('2026-10-14T06:30:00Z', 'UTC')
    seedBase(); seedFixtureDay()
    db.seed('fixed_costs', [{ id: 'fc1', store_id: S, name: 'Rent', amount: 15000, frequency: 'monthly', category: 'rent', is_active: true }])
    db.seed('fixed_cost_overrides', [{ fixed_cost_id: 'fc1', month: '2026-10', amount: 18000 }])
    const r = await buildPeriodReport(client as never, S, 'daily')
    console.log(`[B-MONEY] daily report: ${JSON.stringify({ sales: r.sales, purchases: r.purchases, totalExpenses: r.totalExpenses, fixedCosts: r.fixedCosts, netProfit: r.netProfit, pay: r.paymentBreakdown })}`)
    expect(r.sales).toBe(950)        // 950.49 rounded
    expect(r.purchases).toBe(300)
    expect(r.totalExpenses).toBe(50)
    expect(r.paymentBreakdown.credit).toBe(500)
    expect(r.fixedCosts).toBe(600)   // 18000 / 30 per spec 4e
    expect(r.netProfit).toBe(0)      // 950.49 - 300 - 600 - 50 = 0.49
  })

  it('monthly report for October: a Rs15000/month rent must cost Rs15000, not 31/30 of it', async () => {
    at('2026-10-14T06:30:00Z', 'UTC')
    seedBase()
    db.seed('fixed_costs', [{ id: 'fc1', store_id: S, name: 'Rent', amount: 15000, frequency: 'monthly', category: 'rent', is_active: true }])
    const r = await buildPeriodReport(client as never, S, 'monthly')
    console.log(`[B-MONEY] monthly fixed cost Oct: reported=${r.fixedCosts} expected=15000`)
    expect(r.fixedCosts).toBe(15000)
  })

  it('monthly report for October with override Rs18000: fixed cost must be Rs18000', async () => {
    at('2026-10-14T06:30:00Z', 'UTC')
    seedBase()
    db.seed('fixed_costs', [{ id: 'fc1', store_id: S, name: 'Rent', amount: 15000, frequency: 'monthly', category: 'rent', is_active: true }])
    db.seed('fixed_cost_overrides', [{ fixed_cost_id: 'fc1', month: '2026-10', amount: 18000 }])
    const r = await buildPeriodReport(client as never, S, 'monthly')
    console.log(`[B-MONEY] monthly override Oct: reported=${r.fixedCosts} expected=18000`)
    expect(r.fixedCosts).toBe(18000)
  })

  it('tax: an 18% GST product sold via entry/quick must produce GST collected > 0', async () => {
    at('2026-10-14T06:30:00Z', 'UTC')
    seedBase()
    await quickPOST(jsonRequest('/api/entry/quick', { type: 'sale', paymentMethod: 'cash', items: [{ productId: 'p18', quantity: 1 }] }))
    const row = db.rows('transactions')[0]
    const r = await buildPeriodReport(client as never, S, 'daily')
    console.log(`[B-MONEY] GST: tx.tax_amount=${row.tax_amount} item.tax_rate=${db.rows('transaction_items')[0]?.tax_rate} report.taxSummary=${JSON.stringify(r.taxSummary)} expected collected=18 (118 incl. 18% GST)`)
    expect(r.taxSummary.collected).toBeGreaterThan(0)
  })

  it('more than 1000 transactions in a month must all be counted (PostgREST max-rows = 1000)', async () => {
    at('2026-10-28T06:30:00Z', 'UTC')
    db = new FakeDb({ seed: 3, maxLatencyMs: 0, maxRows: 1000 })
    client = makeClient(db, U)
    seedBase()
    const rows = Array.from({ length: 1200 }, (_, i) => tx(`2026-10-${String(1 + (i % 28)).padStart(2, '0')}`, 'sale', 'cash', 10))
    db.seed('transactions', rows)
    const r = await buildPeriodReport(client as never, S, 'monthly')
    console.log(`[B-MONEY] 1200 sales x Rs10 in October: reported sales=${r.sales} expected=12000 transactionCount=${r.transactionCount}`)
    expect(r.sales).toBe(12000)
  })
})

describe('IST day boundary', () => {
  it('a sale rung up at 01:30 IST on 15 Oct must be dated 2026-10-15', async () => {
    at('2026-10-14T20:00:00Z', 'UTC') // = 2026-10-15 01:30 IST
    seedBase()
    await quickPOST(jsonRequest('/api/entry/quick', { type: 'sale', paymentMethod: 'cash', items: [{ productId: 'p1', quantity: 1 }] }))
    const d = db.rows('transactions')[0].date
    console.log(`[B-MONEY] 01:30 IST sale stored with date=${d} expected=2026-10-15 (dashboard "today" is IST 2026-10-15, so this sale is invisible there)`)
    expect(d).toBe('2026-10-15')
  })

  it('daily report at 01:30 IST on 15 Oct must cover 15 Oct, not 14 Oct', () => {
    at('2026-10-14T20:00:00Z', 'UTC')
    const b = getPeriodBounds('daily')
    const start = b.start.toISOString().slice(0, 10)
    console.log(`[B-MONEY] daily bounds at 01:30 IST (server UTC): start=${start} expected=2026-10-15`)
    expect(start).toBe('2026-10-15')
  })

  it('server running in IST (local dev): October monthly report must not include 30 Sep', async () => {
    at('2026-10-14T06:30:00Z', 'Asia/Kolkata')
    seedBase()
    db.seed('transactions', [tx('2026-09-30', 'sale', 'cash', 999), tx('2026-10-01', 'sale', 'cash', 1)])
    const r = await buildPeriodReport(client as never, S, 'monthly')
    console.log(`[B-MONEY] TZ=Asia/Kolkata monthly sales=${r.sales} expected=1 (999 is dated 30 Sep)`)
    expect(r.sales).toBe(1)
  })
})

describe('opening balance carry-forward (GET /api/reconciliation)', () => {
  it('month boundary: 30 Sep close of Rs2000 opens 1 Oct at Rs2000', async () => {
    at('2026-10-01T06:30:00Z', 'UTC')
    seedBase()
    db.seed('cash_reconciliations', [{ store_id: S, date: '2026-09-30', counted_cash: 2000, opening_cash: 0 }])
    const r = await (await reconGET(new Request('http://x/api/reconciliation?date=2026-10-01'))).json()
    expect(r.openingCash).toBe(2000)
  })

  it('skipped day: closed 12 Oct at Rs1000, 13 Oct had Rs500 cash sales but no close -> 14 Oct opens at Rs1500', async () => {
    at('2026-10-14T06:30:00Z', 'UTC')
    seedBase()
    db.seed('cash_reconciliations', [{ store_id: S, date: '2026-10-12', counted_cash: 1000, opening_cash: 0 }])
    db.seed('transactions', [tx('2026-10-13', 'sale', 'cash', 500)])
    const r = await (await reconGET(new Request('http://x/api/reconciliation?date=2026-10-14'))).json()
    console.log(`[B-MONEY] skipped-day carry: openingCash=${r.openingCash} expected=1500`)
    expect(r.openingCash).toBe(1500)
  })

  it('fixture day via the route: expected drawer 1100.50', async () => {
    at('2026-10-14T06:30:00Z', 'UTC')
    seedBase(); seedFixtureDay()
    db.seed('cash_reconciliations', [{ store_id: S, date: '2026-10-13', counted_cash: 1000, opening_cash: 0 }])
    const r = await (await reconGET(new Request('http://x/api/reconciliation?date=2026-10-14'))).json()
    expect(r.expectedCash).toBe(1100.5)
    expect(r.upiTotal).toBe(199.99)
  })
})

describe('payment method fidelity feeding cash reconciliation', () => {
  it('scanned purchase bill on vendor credit must not be recorded as cash out of the drawer', async () => {
    at('2026-10-14T06:30:00Z', 'UTC')
    seedBase()
    await scanConfirmPOST(jsonRequest('/api/scan/confirm', {
      documentUploadId: '', type: 'purchase', vendorName: 'Saini Traders', paymentMethod: 'credit', totalAmount: 5000,
      items: [{ productNameRaw: 'Parle-G', matchedProductId: 'p1', addAsNew: false, quantity: 500, unitPrice: 10, totalPrice: 5000 }],
    }))
    const pm = db.rows('transactions')[0].payment_method
    console.log(`[B-MONEY] scanned purchase on credit stored payment_method=${pm} expected=credit`)
    expect(pm).toBe('credit')
  })
})

describe('periodic reports (cron)', () => {
  it('Monday 06:00 IST weekly cron must summarise the week that just ended and store real dates', async () => {
    at('2026-10-12T00:30:00Z', 'UTC') // Mon 06:00 IST
    process.env.CRON_SECRET = 'audit-b'
    seedBase()
    db.seed('transactions', Array.from({ length: 7 }, (_, i) => tx(`2026-10-0${5 + i}`, 'sale', 'cash', 100)))
    await weeklyCronGET(new Request('http://x/api/cron/weekly-report', { headers: { authorization: 'Bearer audit-b' } }))
    const rep = db.rows('periodic_reports')[0] as { period_start: string; period_end: string; report_json: { sales: number } }
    console.log(`[B-MONEY] weekly cron: period_start=${rep?.period_start} period_end=${rep?.period_end} sales=${rep?.report_json?.sales} expected 2026-10-05..2026-10-11 sales=700`)
    expect(rep.period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(rep.report_json.sales).toBe(700)
  })
})
