/**
 * Roll up e2e/results/*.json into a per-journey, per-project table and a list
 * of failed steps. Used to write audit/findings-D.md.
 * Run: npx tsx scripts/summarize.ts
 */
import fs from 'fs'
import path from 'path'

const DIR = path.resolve(__dirname, '..', 'results')
type Step = { name: string; status: string; detail?: string; screenshot?: string }
type R = { journey: string; project: string; steps: Step[]; consoleErrors: string[]; pageErrors: string[]; serverErrors: string[] }

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f.includes('__'))
const rows: R[] = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
rows.sort((a, b) => a.journey.localeCompare(b.journey) || a.project.localeCompare(b.project))

for (const r of rows) {
  const pass = r.steps.filter((s) => s.status === 'pass').length
  const fail = r.steps.filter((s) => s.status === 'fail')
  console.log(`\n## ${r.journey} [${r.project}] pass ${pass} / fail ${fail.length}`)
  for (const s of r.steps) {
    if (s.status === 'pass' && !s.detail) continue
    console.log(`  ${s.status.toUpperCase().padEnd(4)} ${s.name}${s.detail ? ` :: ${s.detail.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 400)}` : ''}${s.status === 'fail' && s.screenshot ? ` [${s.screenshot}]` : ''}`)
  }
  const pe = r.pageErrors.filter(Boolean)
  if (pe.length) console.log(`  pageErrors: ${pe.slice(0, 5).join(' || ')}`)
  if (r.serverErrors.length) console.log(`  5xx: ${r.serverErrors.join(', ')}`)
  const ce = r.consoleErrors.filter((c) => !/RSC payload|Fast Refresh|webpack-hmr|Download the React DevTools/.test(c))
  if (ce.length) console.log(`  console: ${ce.slice(0, 5).map((c) => c.slice(0, 160)).join(' || ')}`)
}
