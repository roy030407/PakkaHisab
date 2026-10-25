/**
 * FILE: eval/lib/tasks/voice.ts
 *
 * WHAT THIS DOES:
 *   Voice eval. For each clip: provider -> VoiceParseResult (the app's
 *   parseVoiceAudio for Gemini, with the same catalog bias list the route
 *   builds), then the route's own post-processing (matchItem + buildPendingRow
 *   for items, matchCustomer for udhaar / balance-by-name), then scoring:
 *     - WER of the transcript vs the reference text
 *     - intent accuracy (kind + command + args)
 *     - item extraction precision/recall (name aligned AND qty acceptable)
 *     - cart catalog accuracy (row resolves to the expected product or new:)
 *     - latency, tokens, silently swallowed JSON failures
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Called by eval/run.ts --task voice.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/run.ts ; imports lib/scan/match.ts, lib/voice/{buildCartRow,customer,types}
 */
import fs from 'node:fs'
import path from 'node:path'
import { matchItem } from '@/lib/scan/match'
import { buildPendingRow } from '@/lib/voice/buildCartRow'
import { matchCustomer, type CustomerEntry } from '@/lib/voice/customer'
import type { VoiceParseResult, VoiceCartRow } from '@/lib/voice/types'
import type { VoiceProvider } from '../providers/types'
import type { CallTelemetry } from '../gateway'
import { VOICE_CATALOG, VOICE_CATALOG_NAMES, productIdByName } from '../catalog'
import { nameScore, wordErrorRate, hasDevanagari, ratio, round } from '../text'

const FIX_DIR = path.join(__dirname, '..', '..', 'fixtures', 'voice')

interface ExpItem { name: string; aliases: string[]; qty: number[]; catalog: string | null }
interface Expect { kind: 'items' | 'command'; command: string | null; args?: { quantity?: number; customerName?: string }; customerId?: string; items: ExpItem[] }
export interface VoiceFixture { id: string; source: string; audio?: string; text: string; tags: string[]; private?: boolean; effect?: string; expect: Expect }

export interface VoiceFixtureResult {
  id: string
  tags: string[]
  reference: string
  transcript: string
  wer: number | null
  devanagari: boolean
  error: { kind: string; status?: number; message: string } | null
  telemetry: CallTelemetry[]
  intentOk: boolean
  intent: { expKind: string; kind: string | null; expCommand: string | null; command: string | null; args: unknown; customer: string | null }
  expCount: number
  predCount: number
  itemMatches: number
  cartCatalogOk: number
  cartCatalogScored: number
  items: { exp: string; pred: string | null; qtyExp: number[]; qtyPred: number | null; ok: boolean; cart: string | null; cartOk: boolean | null; reason: string | null }[]
  extras: string[]
  cart: VoiceCartRow[]
  parsed: VoiceParseResult | null
}

function loadFixtures(): { fixtures: VoiceFixture[]; robustness: VoiceFixture[]; customers: CustomerEntry[] } {
  return JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'fixtures.json'), 'utf8'))
}

function audioPath(f: VoiceFixture): string {
  if (f.audio) return path.join(FIX_DIR, f.audio)
  return path.join(FIX_DIR, f.private ? 'private' : 'audio', `${f.id}.webm`)
}

// Mirrors the items branch of app/api/voice/parse/route.ts.
function toCart(parsed: VoiceParseResult): VoiceCartRow[] {
  return parsed.items.map(spoken => {
    const sizeToken = spoken.unit && /\d/.test(spoken.unit) ? spoken.unit : null
    const match = matchItem({ normalizedName: spoken.name, sizeToken }, VOICE_CATALOG)
    const pending = buildPendingRow(spoken, match)
    return {
      productId: pending.productId ?? `new:${pending.name.toLowerCase()}`,
      name: pending.name,
      quantity: pending.quantity,
      unitPrice: pending.productId ? pending.unitPrice : 0,
      addedAsNew: pending.addAsNew,
    }
  })
}

function longExpect(): Expect {
  // X-long60: every distinct item from the concatenated V-clips (qty not scored: phrases repeat).
  const order = path.join(FIX_DIR, 'audio', 'X-long60.order.json')
  const ids: string[] = fs.existsSync(order) ? JSON.parse(fs.readFileSync(order, 'utf8')) : []
  const fx = loadFixtures().fixtures
  const seen = new Map<string, ExpItem>()
  for (const id of ids) for (const it of fx.find(f => f.id === id)?.expect.items ?? []) {
    const k = it.name.toLowerCase()
    if (!seen.has(k)) seen.set(k, { ...it, qty: [] })
  }
  return { kind: 'items', command: null, items: Array.from(seen.values()) }
}

function score(f: VoiceFixture, parsed: VoiceParseResult | null, cart: VoiceCartRow[], customer: CustomerEntry | null) {
  const exp = f.id === 'X-long60' ? longExpect() : f.expect
  const predItems = parsed?.items ?? []
  const pairs: { e: number; p: number; s: number }[] = []
  exp.items.forEach((e, ei) => predItems.forEach((p, pi) => {
    const s = nameScore(p.name, [e.name, ...e.aliases])
    if (s > 0) pairs.push({ e: ei, p: pi, s })
  }))
  pairs.sort((a, b) => b.s - a.s)
  const eUsed = new Map<number, number>()
  const pUsed = new Set<number>()
  for (const pr of pairs) { if (!eUsed.has(pr.e) && !pUsed.has(pr.p)) { eUsed.set(pr.e, pr.p); pUsed.add(pr.p) } }

  const items = exp.items.map((e, ei) => {
    const pi = eUsed.get(ei)
    const p = pi === undefined ? null : predItems[pi]
    const row = pi === undefined ? null : cart[pi] ?? null
    const qtyOk = p !== null && (e.qty.length === 0 || e.qty.some(q => Math.abs(q - p.quantity) < 0.011))
    let cartOk: boolean | null = null
    if (row && e.catalog !== '*') cartOk = e.catalog === null ? row.productId.startsWith('new:') : row.productId === productIdByName.get(e.catalog)
    let reason: string | null = null
    if (!p) reason = `"${e.name}" not extracted`
    else if (!qtyOk) reason = `"${e.name}" qty ${p.quantity}${p.unit ? ' ' + p.unit : ''}, expected ${e.qty.join(' or ')}`
    else if (cartOk === false) reason = `"${e.name}" cart row -> ${row?.productId.startsWith('new:') ? 'new product' : `"${row?.name}"`}, expected ${e.catalog ?? 'new product'}`
    return { exp: e.name, pred: p?.name ?? null, qtyExp: e.qty, qtyPred: p?.quantity ?? null, ok: qtyOk, cart: row?.name ?? null, cartOk, reason }
  })
  const extras = predItems.filter((_, i) => !pUsed.has(i)).map(p => `${p.name} x${p.quantity}`)

  let intentOk = !!parsed && parsed.kind === exp.kind && (parsed.command ?? null) === exp.command
  if (intentOk && exp.args?.quantity !== undefined) intentOk = parsed!.args.quantity === exp.args.quantity
  if (intentOk && exp.customerId) intentOk = customer?.id === exp.customerId
  if (intentOk && exp.kind === 'command' && predItems.length > 0) intentOk = false

  return { exp, items, extras, intentOk }
}

export interface VoiceRunOptions { only?: string[]; includeRobustness: boolean; log: (m: string) => void }

export async function runVoice(provider: VoiceProvider, opts: VoiceRunOptions): Promise<VoiceFixtureResult[]> {
  const spec = loadFixtures()
  const all = [...spec.fixtures, ...spec.robustness]
  let list = opts.includeRobustness ? all : spec.fixtures
  if (opts.only?.length) list = all.filter(f => opts.only!.includes(f.id))

  const results: VoiceFixtureResult[] = []
  for (const f of list) {
    const file = audioPath(f)
    if (!fs.existsSync(file)) { opts.log(`${f.id}: audio missing (${path.relative(FIX_DIR, file)}), skipped`); continue }
    const audioBase64 = fs.readFileSync(file).toString('base64')
    const r = await provider.parse({ audioBase64, mimeType: 'audio/webm', catalogNames: VOICE_CATALOG_NAMES })
    const parsed = r.output
    let customer: CustomerEntry | null = null
    if (parsed?.kind === 'command' && (parsed.command === 'attach_customer' || parsed.command === 'customer_balance') && parsed.args.customerName) {
      customer = matchCustomer(parsed.args.customerName, spec.customers)
    }
    const cart = parsed && parsed.kind === 'items' ? toCart(parsed) : []
    const s = score(f, parsed, cart, customer)
    const transcript = parsed?.transcript ?? ''
    const res: VoiceFixtureResult = {
      id: f.id, tags: f.tags, reference: f.text, transcript,
      wer: f.text ? round(wordErrorRate(f.text, transcript).wer) : null,
      devanagari: hasDevanagari(transcript),
      error: r.error, telemetry: r.telemetry,
      intentOk: s.intentOk,
      intent: { expKind: s.exp.kind, kind: parsed?.kind ?? null, expCommand: s.exp.command, command: parsed?.command ?? null, args: parsed?.args ?? null, customer: customer?.name ?? null },
      expCount: s.exp.items.length, predCount: parsed?.items.length ?? 0,
      itemMatches: s.items.filter(i => i.ok).length,
      cartCatalogOk: s.items.filter(i => i.cartOk === true).length,
      cartCatalogScored: s.items.filter(i => i.cartOk !== null).length,
      items: s.items, extras: s.extras, cart, parsed,
    }
    results.push(res)
    const t = r.telemetry[r.telemetry.length - 1]
    opts.log(`${f.id}: ${r.error ? `ERROR ${r.error.kind} ` : ''}intent ${s.intentOk ? 'ok' : 'WRONG'}, items ${res.itemMatches}/${res.expCount} (pred ${res.predCount}), WER ${res.wer ?? '-'} "${transcript.slice(0, 60)}"${t ? ` (${t.cacheHit ? 'cache' : t.latencyMs + 'ms'})` : ''}`)
  }
  return results
}

export function summarizeVoice(results: VoiceFixtureResult[]) {
  const scored = results.filter(r => !r.id.startsWith('X-'))
  const withRef = scored.filter(r => r.wer !== null)
  const exp = scored.reduce((s, r) => s + r.expCount, 0)
  const pred = scored.reduce((s, r) => s + r.predCount, 0)
  const ok = scored.reduce((s, r) => s + r.itemMatches, 0)
  const tel = results.map(r => r.telemetry[r.telemetry.length - 1]).filter((t): t is CallTelemetry => !!t && !t.error)
  const lat = tel.map(t => t.latencyMs).sort((a, b) => a - b)
  const pct = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null)
  const mean = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  // Corpus WER: total edits / total reference words.
  let edits = 0, words = 0
  for (const r of withRef) { const w = wordErrorRate(r.reference, r.transcript); edits += w.edits; words += w.refWords }
  const tags = Array.from(new Set(scored.flatMap(r => r.tags))).sort()
  const byTag = tags.map(tag => {
    const rs = scored.filter(r => r.tags.includes(tag))
    const e = rs.reduce((s, r) => s + r.expCount, 0)
    const p = rs.reduce((s, r) => s + r.predCount, 0)
    const k = rs.reduce((s, r) => s + r.itemMatches, 0)
    let ed = 0, wd = 0
    for (const r of rs) { const w = wordErrorRate(r.reference, r.transcript); ed += w.edits; wd += w.refWords }
    return { tag, clips: rs.length, intentAcc: ratio(rs.filter(r => r.intentOk).length, rs.length), itemPrecision: ratio(k, p), itemRecall: ratio(k, e), wer: ratio(ed, wd) }
  })
  return {
    clips: scored.length,
    corpusWer: ratio(edits, words),
    meanWer: ratio(withRef.reduce((s, r) => s + (r.wer ?? 0), 0), withRef.length),
    devanagariTranscripts: scored.filter(r => r.devanagari).length,
    intentAcc: ratio(scored.filter(r => r.intentOk).length, scored.length),
    commandIntentAcc: ratio(scored.filter(r => r.intent.expKind === 'command' && r.intentOk).length, scored.filter(r => r.intent.expKind === 'command').length),
    itemsIntentAcc: ratio(scored.filter(r => r.intent.expKind === 'items' && r.intentOk).length, scored.filter(r => r.intent.expKind === 'items').length),
    itemPrecision: ratio(ok, pred), itemRecall: ratio(ok, exp),
    cartCatalogAcc: ratio(scored.reduce((s, r) => s + r.cartCatalogOk, 0), scored.reduce((s, r) => s + r.cartCatalogScored, 0)),
    jsonFailuresSwallowed: results.filter(r => r.error?.kind === 'json_parse' || r.error?.kind === 'empty').length,
    httpFailures: results.filter(r => r.error?.kind === 'http').length,
    firstAttemptFailures: results.filter(r => r.telemetry.some(t => t.attempts > 1)).length,
    truncated: results.filter(r => r.telemetry.some(t => t.finishReason === 'MAX_TOKENS')).length,
    latencyMsP50: pct(0.5), latencyMsP95: pct(0.95),
    promptTokensMean: mean(tel.map(t => t.promptTokens)), outputTokensMean: mean(tel.map(t => t.outputTokens)),
    thoughtsTokensMean: mean(tel.map(t => t.thoughtsTokens)),
    byTag,
  }
}

export function worstVoice(results: VoiceFixtureResult[], n = 10) {
  const badness = (r: VoiceFixtureResult) => (r.intentOk ? 0 : 2) + (r.expCount ? 1 - r.itemMatches / r.expCount : 0) + r.extras.length * 0.5 + (r.wer ?? 0) * 0.25
  return [...results].sort((a, b) => badness(b) - badness(a)).slice(0, n).map(r => ({
    id: r.id, tags: r.tags, reference: r.reference, transcript: r.transcript,
    why: [
      ...(r.error ? [`${r.error.kind}${r.error.status ? ' ' + r.error.status : ''}: ${r.error.message.slice(0, 140)}`] : []),
      ...(!r.intentOk ? [`intent: expected ${r.intent.expKind}/${r.intent.expCommand ?? '-'}, got ${r.intent.kind ?? '-'}/${r.intent.command ?? '-'}${r.intent.customer ? ` (customer ${r.intent.customer})` : ''} args ${JSON.stringify(r.intent.args)}`] : []),
      ...r.items.map(i => i.reason).filter((x): x is string => !!x),
      ...r.extras.map(e => `extra item "${e}"`),
    ],
  }))
}
