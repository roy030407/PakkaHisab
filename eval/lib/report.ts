/**
 * FILE: eval/lib/report.ts
 *
 * WHAT THIS DOES:
 *   Writes eval/results/<date>-<task>-<model>[-<label>].json (full per-case
 *   detail) and a matching .md summary: headline metrics, per-tag table,
 *   cause counts, and the worst 10 cases with why they failed.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Called by eval/run.ts at the end of a run.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/run.ts ; no app imports
 */
import fs from 'node:fs'
import path from 'node:path'

export const RESULTS_DIR = path.join(__dirname, '..', 'results')

type Dict = Record<string, unknown>

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3)
  return String(v)
}

function table(rows: Dict[]): string {
  if (!rows.length) return '_none_\n'
  const cols = Object.keys(rows[0])
  return [
    `| ${cols.join(' | ')} |`,
    `| ${cols.map(() => '---').join(' | ')} |`,
    ...rows.map(r => `| ${cols.map(c => fmt(r[c]).replace(/\|/g, '/')).join(' | ')} |`),
  ].join('\n') + '\n'
}

export function writeReport(args: {
  task: string; model: string; provider: string; label?: string
  options: Dict; summary: Dict & { byTag?: Dict[]; causeCounts?: Record<string, number> }
  worst: { id: string; why: string[]; [k: string]: unknown }[]
  results: unknown[]
}): { json: string; md: string } {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '_')
  const base = `${date}-${args.task}-${safe(args.model)}${args.label ? '-' + safe(args.label) : ''}`
  const json = path.join(RESULTS_DIR, `${base}.json`)
  const md = path.join(RESULTS_DIR, `${base}.md`)
  fs.writeFileSync(json, JSON.stringify({ ...args, generatedAt: new Date().toISOString() }, null, 2))

  const { byTag, causeCounts, ...headline } = args.summary
  const lines: string[] = [
    `# Eval: ${args.task} / ${args.model}${args.label ? ` (${args.label})` : ''}`,
    '',
    `Provider: ${args.provider}. Generated ${new Date().toISOString()}. Options: \`${JSON.stringify(args.options)}\``,
    '',
    '## Headline',
    '',
    table(Object.entries(headline).map(([metric, value]) => ({ metric, value }))),
  ]
  if (byTag?.length) lines.push('## By tag', '', table(byTag))
  if (causeCounts && Object.keys(causeCounts).length) {
    lines.push('## Failure causes (item level)', '', table(Object.entries(causeCounts).sort((a, b) => b[1] - a[1]).map(([cause, count]) => ({ cause, count }))))
  }
  lines.push('## Worst 10 cases', '')
  for (const w of args.worst) {
    const extra = Object.entries(w).filter(([k]) => !['id', 'why', 'tags'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : fmt(v)}`).join(', ')
    lines.push(`### ${w.id}${extra ? ` (${extra})` : ''}`, '', ...(w.why.length ? w.why.map(y => `- ${y}`) : ['- no item-level errors (low score from extras or total only)']), '')
  }
  fs.writeFileSync(md, lines.join('\n'))
  return { json, md }
}
