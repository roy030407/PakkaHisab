// Session A: heuristic dead-code finder.
// 1) Files in components/, lib/, hooks/, types/, data/ never imported anywhere (by path stem).
// 2) Named exports never referenced by name in any other non-test source file.
// Next.js route/page/layout files, scripts and tests are treated as entry points.
const fs = require('fs')
const path = require('path')

const roots = ['app', 'components', 'lib', 'hooks', 'types', 'data', 'scripts']
const files = []
function walk(d) {
  if (!fs.existsSync(d)) return
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f).split(path.sep).join('/')
    if (p.includes('lib/generated')) continue
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(p)) files.push(p)
  }
}
roots.forEach(walk)
files.push('middleware.ts')
const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(f, 'utf8')]))

const isTest = (f) => /\.test\.ts$/.test(f)
const isEntry = (f) =>
  /^app\/.*(page|layout|route|loading|error|not-found|global-error)\.tsx?$/.test(f) ||
  f === 'middleware.ts' ||
  f.startsWith('scripts/') ||
  isTest(f)

console.log('== files never imported (excluding Next entry points, scripts and tests)')
for (const f of files) {
  if (isEntry(f)) continue
  const stem = f.replace(/\.(ts|tsx)$/, '').replace(/\/index$/, '')
  const base = path.basename(stem)
  const relRe = new RegExp(`from ['"]\\.{1,2}/[^'"]*${base}['"]`)
  const used = files.some(
    (o) =>
      o !== f &&
      (src[o].includes(`@/${stem}'`) || src[o].includes(`@/${stem}"`) || relRe.test(src[o]))
  )
  if (!used) console.log('  ' + f)
}

console.log('== named exports with no reference outside their own file (tests excluded)')
for (const f of files) {
  if (isEntry(f)) continue
  const names = [
    ...src[f].matchAll(/export\s+(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g),
  ].map((m) => m[1])
  for (const m of src[f].matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((s) => {
      const n = s.trim().split(/\s+as\s+/).pop()
      if (n) names.push(n)
    })
  }
  for (const n of names) {
    const re = new RegExp(`\\b${n}\\b`)
    const used = files.some((o) => o !== f && !isTest(o) && re.test(src[o]))
    if (!used) {
      const selfUses = (src[f].match(new RegExp(`\\b${n}\\b`, 'g')) || []).length
      console.log(`  ${f}: ${n}${selfUses > 1 ? ' (used internally only)' : ''}`)
    }
  }
}
