// Session A: print per-file line/branch coverage from vitest's json-summary output.
// Run A-coverage.sh first with --coverage.reporter=json-summary (see A-coverage.sh).
const path = require('path')
const s = require(path.resolve(__dirname, 'A-out/coverage/coverage-summary.json'))
const rows = []
for (const [f, v] of Object.entries(s)) {
  if (f === 'total') {
    console.log(`TOTAL lines ${v.lines.pct}% branches ${v.branches.pct}%`)
    continue
  }
  const rel = f.split(path.sep).join('/').replace(/.*KhaataOnline\//, '')
  rows.push([v.lines.pct, v.branches.pct, rel])
}
rows.sort((a, b) => a[0] - b[0])
for (const [l, b, f] of rows) console.log(`${String(l).padStart(6)}% lines ${String(b).padStart(6)}% branches  ${f}`)
