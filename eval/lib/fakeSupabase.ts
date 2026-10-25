/**
 * FILE: eval/lib/fakeSupabase.ts
 *
 * WHAT THIS DOES:
 *   A tiny in-memory stand-in for the Supabase client, just rich enough for
 *   the production functions the eval calls (extractBillData, resolveItems):
 *   from(table).select().eq().is().gte().in().order().limit(), awaited.
 *   Lets the eval run the real app code against a fixture catalog and a
 *   fixture set of extraction_corrections with no database.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Built per run by eval/lib/providers/gemini.ts and eval/lib/tasks/scan.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/lib/tasks/scan.ts ; no app imports
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type Row = Record<string, unknown>
export type Tables = Record<string, Row[]>

class Query implements PromiseLike<{ data: Row[] | Row | null; error: null }> {
  private rows: Row[]
  private max: number | null = null
  private single = false

  constructor(rows: Row[]) { this.rows = rows.slice() }

  select(): this { return this }
  eq(col: string, val: unknown): this { this.rows = this.rows.filter(r => r[col] === undefined || r[col] === val); return this }
  is(col: string, val: unknown): this { this.rows = this.rows.filter(r => (r[col] ?? null) === val); return this }
  gte(col: string, val: unknown): this { this.rows = this.rows.filter(r => r[col] === undefined || String(r[col]) >= String(val)); return this }
  in(col: string, vals: unknown[]): this { this.rows = this.rows.filter(r => vals.includes(r[col])); return this }
  order(col: string, opts: { ascending?: boolean } = {}): this {
    const dir = opts.ascending === false ? -1 : 1
    this.rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -dir : String(a[col]) > String(b[col]) ? dir : 0))
    return this
  }
  limit(n: number): this { this.max = n; return this }
  maybeSingle(): this { this.single = true; return this }

  then<A = { data: Row[] | Row | null; error: null }, B = never>(
    onfulfilled?: ((v: { data: Row[] | Row | null; error: null }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const rows = this.max === null ? this.rows : this.rows.slice(0, this.max)
    const data = this.single ? rows[0] ?? null : rows
    return Promise.resolve({ data, error: null as null }).then(onfulfilled, onrejected)
  }
}

export function makeFakeSupabase(tables: Tables): SupabaseClient {
  const fake = { from: (table: string) => new Query(tables[table] ?? []) }
  return fake as unknown as SupabaseClient
}
