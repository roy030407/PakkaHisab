/**
 * Network-level mocks for every route that calls Gemini.
 *
 * Gemini is only called server-side, so the mocks intercept the browser's
 * call to our own AI-backed routes (/api/scan, /api/voice/parse,
 * /api/ai/chat, /api/ai/insight, /api/import/map) and return fixtures in the
 * exact response shape those routes produce. Fixtures are built from the
 * test store's real product and customer ids, so everything downstream
 * (scan/confirm, entry/quick, import/confirm) runs against the real DB.
 *
 * Coverage note: the server code that sits between Gemini and the response
 * (resolveItems, duplicate detection, voice catalog matching) is NOT exercised
 * by these journeys; it is replaced by the fixture.
 */
import type { Page, Route } from '@playwright/test'
import { randomUUID } from 'crypto'
import type { ApiProduct } from './session'

export interface MockLog { route: string; count: number }

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

// ─── Scan ────────────────────────────────────────────────────────────────

export interface ScanFixtureOpts {
  vendorName?: string
  duplicateOf?: { id: string; date: string } | null
  ledger?: boolean
}

/**
 * A realistic printed kirana supplier bill: one clean match, one guessed
 * (needsVerify) line, one size choice, one qty/price ambiguity and one item
 * that is not in the catalog.
 */
export function supplierBillFixture(p: { clean: ApiProduct; guessed: ApiProduct; ambiguous: ApiProduct; variants: ApiProduct[] }, opts: ScanFixtureOpts = {}) {
  const items = [
    {
      productNameRaw: p.clean.name.toUpperCase(),
      normalizedName: p.clean.name.toLowerCase(),
      sizeToken: null,
      matchedProductId: p.clean.id,
      matchedProductName: p.clean.name,
      matchState: 'matched',
      candidates: [],
      quantity: 10,
      unitPrice: Number(p.clean.purchase_price),
      totalPrice: 10 * Number(p.clean.purchase_price),
      taxRate: 5,
      fillSource: 'bill',
      needsVerify: false,
      ambiguousQtyPrice: false,
      numberTokens: [
        { value: 10, guessedRole: 'quantity', hasCurrencyMarker: false, hasMultiplyMarker: true, confidence: 'high' },
        { value: Number(p.clean.purchase_price), guessedRole: 'price', hasCurrencyMarker: true, hasMultiplyMarker: false, confidence: 'high' },
      ],
    },
    {
      productNameRaw: `${p.guessed.name.split(' ')[0]} ${p.guessed.name.split(' ')[1] ?? ''}`.trim(),
      normalizedName: p.guessed.name.toLowerCase(),
      sizeToken: null,
      matchedProductId: p.guessed.id,
      matchedProductName: p.guessed.name,
      matchState: 'matched',
      candidates: [],
      quantity: 1,
      unitPrice: Number(p.guessed.purchase_price),
      totalPrice: Number(p.guessed.purchase_price),
      taxRate: 5,
      fillSource: 'catalog',
      needsVerify: true,
      ambiguousQtyPrice: false,
      numberTokens: [],
    },
    {
      productNameRaw: 'THUMS UP 1L',
      normalizedName: 'thums up',
      sizeToken: '1L',
      matchState: 'variant_choice',
      candidates: p.variants.map((v) => ({
        productId: v.id,
        name: v.name,
        unitPrice: Number(v.purchase_price),
        sizeToken: (v.name.match(/\d+\s?(ml|l)/i) ?? [null])[0],
      })),
      quantity: 6,
      unitPrice: 0,
      totalPrice: 0,
      taxRate: 28,
      fillSource: 'bill',
      needsVerify: true,
      ambiguousQtyPrice: false,
      numberTokens: [{ value: 6, guessedRole: 'quantity', hasCurrencyMarker: false, hasMultiplyMarker: false, confidence: 'medium' }],
    },
    {
      productNameRaw: p.ambiguous.name,
      normalizedName: p.ambiguous.name.toLowerCase(),
      sizeToken: null,
      matchedProductId: p.ambiguous.id,
      matchedProductName: p.ambiguous.name,
      matchState: 'matched',
      candidates: [],
      quantity: 1,
      unitPrice: Number(p.ambiguous.purchase_price),
      totalPrice: Number(p.ambiguous.purchase_price),
      taxRate: 5,
      fillSource: 'catalog',
      needsVerify: true,
      ambiguousQtyPrice: true,
      numberTokens: [{ value: 12, guessedRole: 'unknown', hasCurrencyMarker: false, hasMultiplyMarker: false, confidence: 'low' }],
    },
    {
      productNameRaw: 'Haldiram Aloo Bhujia 400g',
      normalizedName: 'haldiram aloo bhujia',
      sizeToken: '400g',
      matchState: 'unmatched',
      candidates: [],
      quantity: 4,
      unitPrice: 95,
      totalPrice: 380,
      taxRate: 12,
      fillSource: 'bill',
      needsVerify: false,
      ambiguousQtyPrice: false,
      numberTokens: [],
    },
  ]
  const total = items.reduce((s, i) => s + i.totalPrice, 0)
  return {
    documentUploadId: randomUUID(),
    extraction: {
      documentType: opts.ledger ? 'ledger_page' : 'single_bill',
      vendorName: opts.vendorName ?? 'Sri Balaji Traders',
      date: new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10),
      totalAmount: total,
      confidence: 'medium',
      items,
    },
    duplicateWarning: opts.duplicateOf ?? null,
  }
}

/** A handwritten khata page: party names with amounts; one row has qty 3. */
export function ledgerPageFixture() {
  const row = (name: string, qty: number, unit: number) => ({
    productNameRaw: name,
    normalizedName: name.toLowerCase(),
    sizeToken: null,
    matchState: 'unmatched',
    candidates: [],
    quantity: qty,
    unitPrice: unit,
    totalPrice: qty * unit,
    fillSource: 'bill',
    needsVerify: false,
    ambiguousQtyPrice: false,
    numberTokens: [],
  })
  const items = [row('Ramesh bhai - doodh', 1, 240), row('Sita ben udhaar', 1, 1150), row('Chai patti 250g', 3, 120), row('Kiran store', 1, 560)]
  return {
    documentUploadId: randomUUID(),
    extraction: {
      documentType: 'ledger_page',
      vendorName: undefined,
      date: undefined,
      totalAmount: items.reduce((s, i) => s + i.totalPrice, 0),
      confidence: 'low',
      items,
    },
    duplicateWarning: null,
    expectedDayTotal: items.reduce((s, i) => s + i.totalPrice, 0), // 240+1150+360+560 = 2310
  }
}

/** Serve scan fixtures in order; repeats the last one when the list runs out. */
export async function mockScan(page: Page, fixtures: unknown[], log: MockLog = { route: '/api/scan', count: 0 }) {
  await page.route('**/api/scan', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const f = fixtures[Math.min(log.count, fixtures.length - 1)]
    log.count += 1
    await new Promise((r) => setTimeout(r, 400)) // let the loading state render
    await json(route, f)
  })
  return log
}

// ─── Voice ───────────────────────────────────────────────────────────────

export function voiceItems(transcript: string, rows: Array<{ productId: string; name: string; quantity: number; unitPrice: number; addedAsNew?: boolean }>) {
  return {
    transcript,
    kind: 'items',
    cartItems: rows.map((r) => ({ addedAsNew: false, ...r })),
    command: null,
    args: {},
  }
}

export function voiceCommand(transcript: string, command: string, args: Record<string, unknown> = {}, customer?: unknown) {
  return { transcript, kind: 'command', cartItems: [], command, args, customer }
}

/** Serve voice parse results in order; after the script ends, return a no-op. */
export async function mockVoice(page: Page, script: unknown[], log: MockLog = { route: '/api/voice/parse', count: 0 }) {
  await page.route('**/api/voice/parse', async (route) => {
    const f = script[log.count] ?? { transcript: '', kind: 'items', cartItems: [], command: null, args: {} }
    log.count += 1
    await json(route, f)
  })
  return log
}

// ─── Advisor ─────────────────────────────────────────────────────────────

export const INSIGHT_TEXT =
  'Your Tuesday sales are about 30% lower than other weekdays. A small Tuesday offer on Parle-G and Tata Salt could bring footfall back.'

export const CHAT_ANSWER =
  'Cash is low mainly because purchases this month (Rs 18,400) ran ahead of cash sales (Rs 12,150), and Sita ben still owes Rs 1,150 in udhaar. Collect pending udhaar and slow down the next Parle-G order.'

export async function mockAdvisor(page: Page) {
  await page.route('**/api/ai/insight', (route) => json(route, { insight: INSIGHT_TEXT, cached: false }))
  await page.route('**/api/ai/chat', async (route) => {
    const words = CHAT_ANSWER.split(' ')
    const chunks: string[] = []
    for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' ') + ' ')
    const body =
      chunks.map((c) => `data: ${JSON.stringify({ text: c })}\n\n`).join('') +
      `data: ${JSON.stringify({ conversationId: randomUUID() })}\n\n` +
      'data: [DONE]\n\n'
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body })
  })
}

/** Keep the dashboard InsightCard and advisor TipBanner off the real API in every journey. */
export async function mockInsightOnly(page: Page) {
  await page.route('**/api/ai/insight', (route) => json(route, { insight: INSIGHT_TEXT, cached: true }))
}

// ─── Import column mapping ───────────────────────────────────────────────

const MAP_GUESS: Record<string, string> = {
  'item name': 'name', name: 'name', product: 'name', 'product name': 'name', 'उत्पाद': 'name', 'सामान': 'name',
  brand: 'brand', category: 'category', unit: 'unit',
  mrp: 'selling_price', 'selling price': 'selling_price', price: 'selling_price', 'बिक्री मूल्य': 'selling_price',
  cost: 'purchase_price', 'purchase price': 'purchase_price', 'खरीद मूल्य': 'purchase_price',
  gst: 'tax_rate', 'gst %': 'tax_rate', 'tax rate': 'tax_rate',
}

/** Mimic what Gemini returns for a product sheet: dataType + header mapping. */
export async function mockImportMap(page: Page) {
  await page.route('**/api/import/map', async (route) => {
    const { headers } = route.request().postDataJSON() as { headers: string[] }
    const mapping: Record<string, string | null> = {}
    for (const h of headers) mapping[h] = MAP_GUESS[h.trim().toLowerCase()] ?? null
    await json(route, { dataType: 'products', mapping })
  })
}
