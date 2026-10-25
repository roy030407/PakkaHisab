/**
 * FILE: audit/scripts/B-schema-diff.ts
 *
 * WHAT THIS DOES:
 *   Static schema truth check. Builds the column set per table from
 *   prisma/schema.prisma (@map names) plus supabase/migrations/*.sql
 *   (CREATE TABLE / ADD COLUMN), then scans app/, lib/, components/ for
 *   supabase-js chains `.from('<table>')` and collects every column named in
 *   .select('...'), .eq/.neq/.in/.is/.gt/.gte/.lt/.lte/.order('<col>') and in
 *   object keys of .insert({...}) / .update({...}) / .upsert({...}) literals.
 *   Prints: columns used but not in schema, and schema columns never used.
 *
 * RUN: npx tsx audit/scripts/B-schema-diff.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const schema = new Map<string, Set<string>>()
const add = (t: string, c: string) => { if (!schema.has(t)) schema.set(t, new Set()); schema.get(t)!.add(c) }

// prisma
const prisma = readFileSync('prisma/schema.prisma', 'utf8')
for (const m of prisma.matchAll(/model\s+\w+\s*\{([\s\S]*?)\n\}/g)) {
  const body = m[1]
  const table = body.match(/@@map\("(\w+)"\)/)?.[1]
  if (!table) continue
  for (const line of body.split('\n')) {
    const f = line.trim().match(/^(\w+)\s+([A-Z]\w*)(\[\])?\??/)
    if (!f || f[3] || /^[A-Z]/.test(f[2]) && !['String', 'Int', 'Boolean', 'DateTime', 'Decimal', 'Json'].includes(f[2])) continue
    add(table, line.match(/@map\("(\w+)"\)/)?.[1] ?? f[1])
  }
}
// migrations
for (const f of readdirSync('supabase/migrations')) {
  const sql = readFileSync(join('supabase/migrations', f), 'utf8')
  for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g)) {
    for (const line of m[2].split('\n')) {
      const c = line.trim().match(/^([a-z_]+)\s+(text|TEXT|date|numeric|NUMERIC|timestamptz|TIMESTAMPTZ|uuid|int|boolean)/)
      if (c) add(m[1], c[1])
    }
  }
  for (const m of sql.matchAll(/ALTER TABLE (\w+)\s+ADD COLUMN IF NOT EXISTS (\w+)/g)) add(m[1], m[2])
}

function walk(dir: string, out: string[] = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (n === 'node_modules' || n === 'generated') continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) out.push(p)
  }
  return out
}

const used = new Map<string, Map<string, Set<string>>>() // table -> col -> files
const mark = (t: string, c: string, file: string) => {
  if (!used.has(t)) used.set(t, new Map())
  const m = used.get(t)!
  if (!m.has(c)) m.set(c, new Set())
  m.get(c)!.add(file)
}

for (const file of [...walk('app'), ...walk('lib'), ...walk('components')]) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/\.from\(\s*['"](\w+)['"]\s*\)/g)) {
    const table = m[1]
    // the chain: up to the next `.from(` or 1500 chars, stopping at a blank line
    const rest = src.slice(m.index! + m[0].length, m.index! + 1500)
    const chain = rest.split(/\n\s*\n|\.from\(/)[0]
    const sel = chain.match(/^\s*\.select\(\s*['"`]([^'"`]*)['"`]/)
    if (sel) {
      for (const raw of sel[1].split(',')) {
        const c = raw.trim().split(/[\s:(!]/)[0]
        if (c && c !== '*' && /^[a-z_]+$/.test(c) && !raw.includes('(')) mark(table, c, file)
      }
    }
    for (const f of chain.matchAll(/\.(eq|neq|in|is|gt|gte|lt|lte|order|not|ilike)\(\s*['"](\w+)['"]/g)) mark(table, f[2], file)
    const w = chain.match(/^\s*\.(insert|update|upsert)\(\s*\{([\s\S]*?)\}\s*[,)]/)
    if (w) for (const k of w[2].matchAll(/(?:^|[,{\n])\s*([a-z_]+)\s*:/g)) mark(table, k[1], file)
  }
}

let problems = 0
console.log('=== Columns referenced in code but NOT in prisma/migrations ===')
for (const [t, cols] of used) {
  if (!schema.has(t)) { console.log(`TABLE ${t} not in schema (files: ${[...new Set([...cols.values()].flatMap(s => [...s]))].join(', ')})`); problems++; continue }
  for (const [c, files] of cols) if (!schema.get(t)!.has(c)) { console.log(`${t}.${c}  <- ${[...files].join(', ')}`); problems++ }
}
console.log('\n=== Schema columns never referenced by name in app/lib/components ===')
for (const [t, cols] of schema) {
  const u = used.get(t)
  const unused = [...cols].filter(c => !u?.has(c) && c !== 'id')
  if (!u) console.log(`TABLE ${t}: never queried`)
  else if (unused.length) console.log(`${t}: ${unused.join(', ')}`)
}
process.exitCode = problems ? 1 : 0
