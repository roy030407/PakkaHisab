/**
 * FILE: eval/lib/tasks/scan.ts
 *
 * WHAT THIS DOES:
 *   Scan eval. For each image fixture: provider -> RawExtraction (the app's
 *   extractBillData for Gemini), then the app's own resolveItems() against the
 *   eval catalog (so Fuse STRONG 0.35 / SUGGEST 0.6 matching, variant picking
 *   and qty/price inference are exactly production), then scoring:
 *     - item precision/recall: strict match = name aligned AND qty exact AND
 *       unit price exact (where the ground truth has them)
 *     - qty accuracy, price accuracy, printed-total accuracy, cart value
 *       accuracy, catalog auto-match accuracy, latency, tokens, parse failures
 *   Every failed item gets a machine-readable cause and a human reason.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Called by eval/run.ts --task scan.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/run.ts ; imports lib/scan/resolve.ts and eval/lib/*
 */
import fs from 'node:fs'
import path from 'node:path'
import { resolveItems } from '@/lib/scan/resolve'
import type { ExtractionItem } from '@/types'
import type { RawExtraction } from '@/lib/anthropic/extraction'
import type { ScanProvider } from '../providers/types'
import type { CallTelemetry } from '../gateway'
import { makeFakeSupabase, type Row } from '../fakeSupabase'
import { PRODUCT_ROWS, STORE_ID } from '../catalog'
import { nameScore, ratio, round } from '../text'
import { preparedPath } from '../../fixtures/scan/prepare'

const FIX_DIR = path.join(__dirname, '..', '..', 'fixtures', 'scan')

export interface GtItem { name: string; aliases: string[]; qty: number | number[] | null; price: number | null; catalog: string | null }
export interface ScanFixture {
  id: string; src?: string; srcPrivate?: string; derivedFrom?: string; effect?: string
  tags: string[]; note?: string; total?: number | null; date?: string | null; items?: GtItem[]; expectItems?: number
}

export interface ItemResult {
  gt: string
  pred: string | null
  predRaw: string | null
  nameOk: boolean
  qty: { gt: number | number[] | null; pred: number | null; ok: boolean | null }
  price: { gt: number | null; pred: number | null; ok: boolean | null; fillSource?: string }
  catalog: { gt: string | null; pred: string | null; state: string | null; ok: boolean | null; suggested: boolean }
  strict: boolean
  causes: string[]
  reasons: string[]
}

export interface ScanFixtureResult {
  id: string
  tags: string[]
  error: { kind: string; status?: number; message: string } | null
  telemetry: CallTelemetry[]
  gtCount: number
  predCount: number
  strictMatches: number
  nameMatches: number
  f1: number
  totalOk: boolean | null
  totalPred: number | null
  totalGt: number | null
  cartValueOk: boolean | null
  cartValuePred: number | null
  cartValueGt: number | null
  items: ItemResult[]
  extras: { name: string; qty: number; price: number }[]
  raw: RawExtraction | null
  resolved: ExtractionItem[]
}

function loadFixtures(): { fixtures: ScanFixture[]; robustness: ScanFixture[] } {
  const spec = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'fixtures.json'), 'utf8')) as { fixtures: ScanFixture[]; robustness: ScanFixture[] }
  for (const f of [...spec.fixtures, ...spec.robustness]) f.tags = f.tags ?? ['robustness']
  // Derived fixtures inherit ground truth from their base image.
  for (const f of spec.fixtures) {
    if (f.derivedFrom && !f.items) {
      const base = spec.fixtures.find(b => b.id === f.derivedFrom)
      if (base) { f.items = base.items; f.total = base.total; f.date = base.date }
    }
  }
  return spec
}

function mimeOf(file: string): string {
  const e = path.extname(file).toLowerCase()
  return e === '.png' ? 'image/png' : e === '.webp' ? 'image/webp' : 'image/jpeg'
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.011
const qtyAccepts = (gt: number | number[], v: number) => (Array.isArray(gt) ? gt : [gt]).some(g => near(g, v))

function scoreFixture(f: ScanFixture, raw: RawExtraction | null, resolved: ExtractionItem[]): Omit<ScanFixtureResult, 'error' | 'telemetry' | 'raw' | 'resolved'> {
  const gtItems = f.items ?? []
  // Greedy alignment on name similarity (exact beats containment).
  const pairs: { g: number; p: number; s: number }[] = []
  gtItems.forEach((g, gi) => resolved.forEach((p, pi) => {
    const s = Math.max(nameScore(p.normalizedName ?? '', [g.name, ...g.aliases]), nameScore(p.productNameRaw, [g.name, ...g.aliases]))
    if (s > 0) pairs.push({ g: gi, p: pi, s })
  }))
  pairs.sort((a, b) => b.s - a.s || a.g - b.g)
  const gUsed = new Map<number, number>()
  const pUsed = new Set<number>()
  for (const pr of pairs) {
    if (gUsed.has(pr.g) || pUsed.has(pr.p)) continue
    gUsed.set(pr.g, pr.p); pUsed.add(pr.p)
  }

  const items: ItemResult[] = gtItems.map((g, gi) => {
    const pi = gUsed.get(gi)
    const p = pi === undefined ? undefined : resolved[pi]
    const causes: string[] = []
    const reasons: string[] = []
    if (!p) {
      causes.push('missing')
      reasons.push(`"${g.name}" not extracted`)
      return {
        gt: g.name, pred: null, predRaw: null, nameOk: false,
        qty: { gt: g.qty, pred: null, ok: g.qty === null ? null : false },
        price: { gt: g.price, pred: null, ok: g.price === null ? null : false },
        catalog: { gt: g.catalog, pred: null, state: null, ok: null, suggested: false },
        strict: false, causes, reasons,
      }
    }
    const qtyOk = g.qty === null ? null : qtyAccepts(g.qty, p.quantity)
    const priceOk = g.price === null ? null : near(p.unitPrice, g.price)
    if (qtyOk === false) {
      const gq = Array.isArray(g.qty) ? g.qty[0] : (g.qty as number)
      const sizeNum = p.sizeToken ? Number((p.sizeToken.match(/\d+(?:\.\d+)?/) ?? ['NaN'])[0]) : NaN
      if (p.ambiguousQtyPrice) { causes.push('qty_ambiguous_asked'); reasons.push(`qty left for the merchant (ambiguous), expected ${gq}`) }
      else if (g.price !== null && near(p.quantity, g.price) && near(p.unitPrice, gq)) { causes.push('qty_price_swap'); reasons.push(`qty and price swapped (qty ${p.quantity}, price ${p.unitPrice})`) }
      else if (near(sizeNum, gq)) { causes.push('qty_absorbed_by_size'); reasons.push(`qty ${gq} was read as pack size "${p.sizeToken}", qty became ${p.quantity}`) }
      else if (g.price !== null && near(p.quantity, g.price)) { causes.push('price_read_as_qty'); reasons.push(`price ${g.price} read as quantity`) }
      else { causes.push('qty_wrong'); reasons.push(`qty ${p.quantity}, expected ${JSON.stringify(g.qty)}`) }
    }
    if (priceOk === false) {
      const gq = Array.isArray(g.qty) ? g.qty[0] : (g.qty ?? 1)
      if (p.fillSource === 'catalog') { causes.push('price_from_catalog'); reasons.push(`unit price ${p.unitPrice} came from the catalog, bill says ${g.price}`) }
      else if (p.unitPrice === 0) { causes.push('price_missing'); reasons.push(`no unit price read (bill says ${g.price})`) }
      else if (gq > 1 && near(p.unitPrice, gq * (g.price as number))) { causes.push('line_total_as_unit_price'); reasons.push(`line total ${p.unitPrice} used as unit price (should be ${g.price})`) }
      else if (gq > 1 && p.fillSource === 'inferred') { causes.push('price_inferred_wrong'); reasons.push(`unit price inferred as ${p.unitPrice}, expected ${g.price}`) }
      else { causes.push('price_wrong'); reasons.push(`unit price ${p.unitPrice}, expected ${g.price} (source ${p.fillSource})`) }
    }
    let catOk: boolean | null = null
    const suggested = g.catalog !== null && g.catalog !== '*' && p.candidates.some(c => c.name === g.catalog)
    if (g.catalog !== '*') {
      catOk = g.catalog === null ? p.matchState !== 'matched' : p.matchState === 'matched' && p.matchedProductName === g.catalog
      if (!catOk) {
        if (g.catalog === null) { causes.push('catalog_false_match'); reasons.push(`auto-matched to "${p.matchedProductName}" but the bill item is not in the catalog`) }
        else if (p.matchState === 'matched') { causes.push('catalog_wrong_match'); reasons.push(`auto-matched to "${p.matchedProductName}", expected "${g.catalog}"`) }
        else { causes.push('catalog_no_auto_match'); reasons.push(`not auto-matched (${p.matchState}${suggested ? ', correct one offered as a suggestion' : ''}), expected "${g.catalog}"`) }
      }
    }
    return {
      gt: g.name, pred: p.normalizedName ?? p.productNameRaw, predRaw: p.productNameRaw, nameOk: true,
      qty: { gt: g.qty, pred: p.quantity, ok: qtyOk },
      price: { gt: g.price, pred: p.unitPrice, ok: priceOk, fillSource: p.fillSource },
      catalog: { gt: g.catalog, pred: p.matchedProductName ?? null, state: p.matchState, ok: catOk, suggested },
      strict: qtyOk !== false && priceOk !== false,
      causes, reasons,
    }
  })

  const extras = resolved.filter((_, i) => !pUsed.has(i)).map(p => ({ name: p.normalizedName ?? p.productNameRaw, qty: p.quantity, price: p.unitPrice }))
  const strictMatches = items.filter(i => i.nameOk && i.strict).length
  const nameMatches = items.filter(i => i.nameOk).length
  const prec = resolved.length ? strictMatches / resolved.length : gtItems.length ? 0 : 1
  const rec = gtItems.length ? strictMatches / gtItems.length : resolved.length ? 0 : 1
  const f1 = prec + rec === 0 ? 0 : (2 * prec * rec) / (prec + rec)

  const totalGt = f.total ?? null
  const totalPred = raw?.totalAmount ?? null
  const totalOk = totalGt === null ? null : totalPred !== null && near(totalPred, totalGt)

  const allPriced = gtItems.length > 0 && gtItems.every(g => g.price !== null && g.qty !== null)
  const cartValueGt = allPriced ? round(gtItems.reduce((s, g) => s + (Array.isArray(g.qty) ? g.qty[0] : (g.qty as number)) * (g.price as number), 0), 2) : null
  const cartValuePred = round(resolved.reduce((s, p) => s + p.quantity * p.unitPrice, 0), 2)
  const cartValueOk = cartValueGt === null ? null : near(cartValuePred, cartValueGt)

  return {
    id: f.id, tags: f.tags, gtCount: gtItems.length, predCount: resolved.length,
    strictMatches, nameMatches, f1: round(f1), totalOk, totalPred, totalGt,
    cartValueOk, cartValuePred, cartValueGt: cartValueGt, items, extras,
  }
}

export interface ScanRunOptions {
  only?: string[]
  includeRobustness: boolean
  corrections: Row[]
  log: (m: string) => void
}

export async function runScan(provider: ScanProvider, opts: ScanRunOptions): Promise<ScanFixtureResult[]> {
  const spec = loadFixtures()
  const all = [...spec.fixtures, ...spec.robustness]
  let list = opts.includeRobustness ? all : spec.fixtures
  if (opts.only?.length) list = all.filter(f => opts.only!.includes(f.id))
  const supabase = makeFakeSupabase({ products: PRODUCT_ROWS, extraction_corrections: opts.corrections, transactions: [], transaction_items: [] })

  const results: ScanFixtureResult[] = []
  for (const f of list) {
    const file = preparedPath(f.id, all)
    if (!fs.existsSync(file)) { opts.log(`${f.id}: image missing (run prepare.ts), skipped`); continue }
    const imageBase64 = fs.readFileSync(file).toString('base64')
    const r = await provider.extract({ imageBase64, mimeType: mimeOf(file), supabase, storeId: STORE_ID })
    const resolved = r.output ? await resolveItems(supabase, STORE_ID, r.output.rawItems, 'purchase') : []
    const scored = scoreFixture(f, r.output, resolved)
    const res: ScanFixtureResult = { ...scored, error: r.error, telemetry: r.telemetry, raw: r.output, resolved }
    results.push(res)
    const t = r.telemetry[r.telemetry.length - 1]
    opts.log(`${f.id}: ${r.error ? `ERROR ${r.error.kind}${r.error.status ? ' ' + r.error.status : ''}` : `${scored.strictMatches}/${scored.gtCount} strict, ${scored.predCount} predicted, F1 ${scored.f1}`}${t ? ` (${t.cacheHit ? 'cache' : t.latencyMs + 'ms'})` : ''}`)
  }
  return results
}

export function summarizeScan(results: ScanFixtureResult[]) {
  const items = results.flatMap(r => r.items)
  const gt = results.reduce((s, r) => s + r.gtCount, 0)
  const pred = results.reduce((s, r) => s + r.predCount, 0)
  const strict = results.reduce((s, r) => s + r.strictMatches, 0)
  const named = results.reduce((s, r) => s + r.nameMatches, 0)
  const scored = <K extends 'qty' | 'price' | 'catalog'>(k: K) => items.filter(i => i.nameOk && i[k].ok !== null)
  const tel = results.map(r => r.telemetry[r.telemetry.length - 1]).filter((t): t is CallTelemetry => !!t && !t.error)
  const lat = tel.map(t => t.latencyMs).sort((a, b) => a - b)
  const pct = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null)
  const mean = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  const causeCounts: Record<string, number> = {}
  for (const i of items) for (const c of i.causes) causeCounts[c] = (causeCounts[c] ?? 0) + 1
  causeCounts.extra_item = results.reduce((s, r) => s + r.extras.length, 0)

  const tags = Array.from(new Set(results.flatMap(r => r.tags))).sort()
  const byTag = tags.map(tag => {
    const rs = results.filter(r => r.tags.includes(tag))
    const its = rs.flatMap(r => r.items)
    const g = rs.reduce((s, r) => s + r.gtCount, 0)
    const p = rs.reduce((s, r) => s + r.predCount, 0)
    const st = rs.reduce((s, r) => s + r.strictMatches, 0)
    const q = its.filter(i => i.nameOk && i.qty.ok !== null)
    const pr = its.filter(i => i.nameOk && i.price.ok !== null)
    const c = its.filter(i => i.catalog.ok !== null)
    return {
      tag, fixtures: rs.length, gtItems: g,
      itemPrecision: ratio(st, p), itemRecall: ratio(st, g), nameRecall: ratio(its.filter(i => i.nameOk).length, g),
      qtyAcc: ratio(q.filter(i => i.qty.ok).length, q.length), priceAcc: ratio(pr.filter(i => i.price.ok).length, pr.length),
      catalogAcc: ratio(c.filter(i => i.catalog.ok).length, c.length),
    }
  })

  return {
    fixtures: results.length,
    gtItems: gt, predItems: pred,
    itemPrecision: ratio(strict, pred), itemRecall: ratio(strict, gt),
    namePrecision: ratio(named, pred), nameRecall: ratio(named, gt),
    qtyAcc: ratio(scored('qty').filter(i => i.qty.ok).length, scored('qty').length), qtyScored: scored('qty').length,
    priceAcc: ratio(scored('price').filter(i => i.price.ok).length, scored('price').length), priceScored: scored('price').length,
    totalAcc: ratio(results.filter(r => r.totalOk).length, results.filter(r => r.totalOk !== null).length), totalScored: results.filter(r => r.totalOk !== null).length,
    cartValueAcc: ratio(results.filter(r => r.cartValueOk).length, results.filter(r => r.cartValueOk !== null).length), cartValueScored: results.filter(r => r.cartValueOk !== null).length,
    catalogAcc: ratio(items.filter(i => i.catalog.ok === true).length, items.filter(i => i.catalog.ok !== null).length), catalogScored: items.filter(i => i.catalog.ok !== null).length,
    jsonParseFailures: results.filter(r => r.error?.kind === 'json_parse').length,
    httpFailures: results.filter(r => r.error?.kind === 'http').length,
    otherFailures: results.filter(r => r.error && r.error.kind !== 'json_parse' && r.error.kind !== 'http').length,
    firstAttemptFailures: results.filter(r => r.telemetry.some(t => t.attempts > 1)).length,
    truncated: results.filter(r => r.telemetry.some(t => t.finishReason === 'MAX_TOKENS')).length,
    // Every fixture is a single bill or list; ledger_page routes it to the multi-row LedgerReview screen.
    misroutedAsLedger: results.filter(r => r.raw?.documentType === 'ledger_page').length,
    ambiguousAsked: items.filter(i => i.causes.includes('qty_ambiguous_asked')).length,
    latencyMsP50: pct(0.5), latencyMsP95: pct(0.95),
    promptTokensMean: mean(tel.map(t => t.promptTokens)), outputTokensMean: mean(tel.map(t => t.outputTokens)),
    thoughtsTokensMean: mean(tel.map(t => t.thoughtsTokens)), totalTokensMean: mean(tel.map(t => t.totalTokens)),
    causeCounts, byTag,
  }
}

export function worstScan(results: ScanFixtureResult[], n = 10) {
  return [...results]
    .sort((a, b) => a.f1 - b.f1 || b.items.filter(i => i.causes.length).length - a.items.filter(i => i.causes.length).length)
    .slice(0, n)
    .map(r => ({
      id: r.id, f1: r.f1, tags: r.tags,
      why: r.error
        ? [`${r.error.kind}${r.error.status ? ' ' + r.error.status : ''}: ${r.error.message.slice(0, 160)}`]
        : [
          ...r.items.flatMap(i => i.reasons),
          ...r.extras.map(e => `extra item "${e.name}" (qty ${e.qty}, price ${e.price})`),
          ...(r.totalOk === false ? [`total read as ${r.totalPred}, bill says ${r.totalGt}`] : []),
        ],
    }))
}
