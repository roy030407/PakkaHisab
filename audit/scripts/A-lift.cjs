// Session A: parse every .tsx in app/ and components/ with the TS compiler and list
// raw <button>, <a>, <Link> elements and onClick <div>/<li> rows whose className has
// no lift utility (btn-lift / row-lift / card-lift). shadcn <Button> has lift built in.
const ts = require('typescript'), fs = require('fs'), path = require('path')
const out = { button: [0, []], a: [0, []], Link: [0, []], clickDiv: [0, []] }
function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (p.includes(path.join('components','ui'))) continue; walk(p) } else if (p.endsWith('.tsx')) check(p) } }
function attrs(node) { return node.attributes.properties }
function check(file) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(src)
      const ps = attrs(n)
      const cls = ps.find(a => a.name && a.name.getText(src) === 'className')
      const hasClick = ps.some(a => a.name && a.name.getText(src) === 'onClick')
      const clsText = cls ? cls.getText(src) : ''
      const lifted = /lift/.test(clsText)
      const loc = file + ':' + (src.getLineAndCharacterOfPosition(n.getStart()).line + 1)
      let key = null
      if (tag === 'button') key = 'button'
      else if (tag === 'a') key = 'a'
      else if (tag === 'Link') key = 'Link'
      else if ((tag === 'div' || tag === 'li' || tag === 'tr') && hasClick) key = 'clickDiv'
      if (key) { out[key][0]++; if (!lifted) out[key][1].push(loc) }
    }
    ts.forEachChild(n, visit)
  }
  visit(src)
}
walk('app'); walk('components')
for (const [k, [tot, miss]] of Object.entries(out)) {
  console.log(`${k}: total ${tot}, without lift ${miss.length}`)
  miss.forEach(m => console.log('   ' + m))
}
