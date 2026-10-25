/**
 * FILE: audit/tests/B-fakeSupabase.ts
 *
 * WHAT THIS DOES:
 *   In-memory stand-in for the supabase-js query builder, used by Session B
 *   audit tests to drive the REAL route handlers (app/api/...) without a DB.
 *   Every query awaits a small seeded-random delay, the same way a PostgREST
 *   round-trip yields to the event loop, so concurrent requests interleave
 *   exactly like they do in production (read, other requests run, write).
 *
 * MODELLED (and only this):
 *   - select / insert / update / delete / upsert, eq / neq / in / is / gt / gte /
 *     lt / lte / order / limit / or (ignored), single / maybeSingle, count head.
 *   - Unique constraints: inventory(store_id, product_id),
 *     products(store_id, item_number), cash_reconciliations(store_id, date),
 *     fixed_cost_overrides(fixed_cost_id, month).
 *   - The assign_item_number trigger from 001_rls_policies.sql: MAX(item_number)+1
 *     read from the statement snapshot, unique check at commit.
 *   - NO RLS. Tests that need tenant isolation must use the live script
 *     audit/scripts/B-rls-proof.ts against a dedicated project.
 *
 * WHERE IT FITS:
 *   Imported by audit/tests/B-balance-race.test.ts, B-integrity.test.ts,
 *   B-money.test.ts. Not part of the app build.
 */

type Row = Record<string, unknown>
type Filter = (r: Row) => boolean

const UNIQUES: Record<string, string[][]> = {
  inventory: [['store_id', 'product_id']],
  products: [['store_id', 'item_number']],
  cash_reconciliations: [['store_id', 'date']],
  fixed_cost_overrides: [['fixed_cost_id', 'month']],
  periodic_reports: [['store_id', 'report_type']],
}

let idCounter = 0
const newId = (t: string) => `${t}-${++idCounter}`

/** Deterministic PRNG so race results are reproducible run to run. */
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export class FakeDb {
  tables: Record<string, Row[]> = {}
  private rand: () => number
  maxLatencyMs: number
  /** Models PostgREST db-max-rows (Supabase default 1000). null = unlimited. */
  maxRows: number | null
  /** Every executed query, for assertions about what a route wrote. */
  log: Array<{ table: string; op: string; payload?: unknown }> = []

  constructor(opts: { seed?: number; maxLatencyMs?: number; maxRows?: number | null } = {}) {
    this.rand = lcg(opts.seed ?? 42)
    this.maxLatencyMs = opts.maxLatencyMs ?? 3
    this.maxRows = opts.maxRows ?? null
  }

  rows(table: string): Row[] {
    return (this.tables[table] ??= [])
  }

  seed(table: string, rows: Row[]) {
    for (const r of rows) this.rows(table).push({ id: r.id ?? newId(table), ...r })
  }

  async tick() {
    const ms = Math.floor(this.rand() * (this.maxLatencyMs + 1))
    await new Promise(res => setTimeout(res, ms))
  }

  violatesUnique(table: string, candidate: Row, ignoreId?: unknown): boolean {
    for (const cols of UNIQUES[table] ?? []) {
      const hit = this.rows(table).some(r =>
        r.id !== ignoreId && cols.every(c => r[c] !== undefined && r[c] !== null && r[c] === candidate[c])
      )
      if (hit) return true
    }
    return false
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null
  private filters: Filter[] = []
  private payload: Row | Row[] | null = null
  private returning = false
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private onConflict: string[] = []
  private limitN: number | null = null
  private orderBy: { col: string; asc: boolean } | null = null
  private headCount = false

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === null) this.op = 'select'
    else this.returning = true
    if (opts?.head) this.headCount = true
    return this
  }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this }
  update(p: Row) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  upsert(p: Row | Row[], o?: { onConflict?: string }) {
    this.op = 'upsert'; this.payload = p
    this.onConflict = (o?.onConflict ?? 'id').split(',').map(s => s.trim())
    return this
  }
  eq(c: string, v: unknown) { this.filters.push(r => r[c] === v); return this }
  neq(c: string, v: unknown) { this.filters.push(r => r[c] !== v); return this }
  in(c: string, vs: unknown[]) { this.filters.push(r => vs.includes(r[c])); return this }
  is(c: string, v: null) { this.filters.push(r => (r[c] ?? null) === v); return this }
  gt(c: string, v: never) { this.filters.push(r => (r[c] as never) > v); return this }
  gte(c: string, v: never) { this.filters.push(r => (r[c] as never) >= v); return this }
  lt(c: string, v: never) { this.filters.push(r => (r[c] as never) < v); return this }
  lte(c: string, v: never) { this.filters.push(r => (r[c] as never) <= v); return this }
  or() { return this }
  ilike() { return this }
  not() { return this }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending ?? true }; return this }
  limit(n: number) { this.limitN = n; return this }
  range() { return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }

  then<A, B>(
    res?: ((v: { data: unknown; error: unknown; count?: number | null }) => A | PromiseLike<A>) | null,
    rej?: ((e: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return this.exec().then(res, rej)
  }

  private shape(rows: Row[]) {
    if (this.headCount) return { data: null, error: null, count: rows.length }
    if (this.mode === 'many') return { data: clone(rows), error: null, count: rows.length }
    if (rows.length === 0) {
      return this.mode === 'maybe'
        ? { data: null, error: null }
        : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
    }
    if (rows.length > 1) return { data: null, error: { message: 'multiple rows' } }
    return { data: clone(rows[0]), error: null }
  }

  private match(r: Row) { return this.filters.every(f => f(r)) }

  private async exec(): Promise<{ data: unknown; error: unknown; count?: number | null }> {
    const db = this.db
    db.log.push({ table: this.table, op: this.op ?? 'select', payload: this.payload ? clone(this.payload) : undefined })
    // Network round-trip before the statement runs.
    await db.tick()
    const rows = db.rows(this.table)

    if (this.op === 'select') {
      let out = rows.filter(r => this.match(r))
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        out = [...out].sort((a, b) => ((a[col] as never) > (b[col] as never) ? 1 : -1) * (asc ? 1 : -1))
      }
      if (this.limitN !== null) out = out.slice(0, this.limitN)
      if (!this.headCount && db.maxRows !== null) out = out.slice(0, db.maxRows)
      return this.shape(out)
    }

    if (this.op === 'insert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map(p => ({ ...p }))
      // Statement snapshot: trigger-computed values come from rows visible NOW.
      if (this.table === 'products') {
        const byStore = new Map<unknown, number>()
        for (const p of list) {
          if (!p.item_number) {
            const base = byStore.get(p.store_id) ??
              Math.max(0, ...rows.filter(r => r.store_id === p.store_id).map(r => Number(r.item_number) || 0))
            p.item_number = base + 1
            byStore.set(p.store_id, base + 1)
          }
        }
        // Statement executes; a concurrent statement may commit in between.
        await db.tick()
      }
      for (const p of list) {
        p.id ??= newId(this.table)
        if (db.violatesUnique(this.table, p)) {
          return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${this.table}` } }
        }
      }
      for (const p of list) rows.push(p)
      if (!this.returning) return { data: null, error: null }
      return this.shape(list)
    }

    if (this.op === 'update') {
      const hit = rows.filter(r => this.match(r))
      for (const r of hit) Object.assign(r, this.payload)
      return this.returning ? this.shape(hit) : { data: null, error: null }
    }

    if (this.op === 'delete') {
      const keep = rows.filter(r => !this.match(r))
      db.tables[this.table] = keep
      return { data: null, error: null }
    }

    if (this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!]
      const out: Row[] = []
      for (const p of list) {
        const existing = rows.find(r => this.onConflict.every(c => r[c] === p[c]))
        if (existing) { Object.assign(existing, p); out.push(existing) }
        else { const n = { id: newId(this.table), ...p }; rows.push(n); out.push(n) }
      }
      return this.returning ? this.shape(out) : { data: null, error: null }
    }

    return { data: null, error: { message: 'unsupported op' } }
  }
}

export function makeClient(db: FakeDb, userId: string) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    from: (table: string) => new Query(db, table),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  }
}

export function jsonRequest(url: string, body: unknown, method = 'POST') {
  return new Request(`http://audit.local${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
