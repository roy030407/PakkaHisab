/**
 * Generates every file fixture the Session D journeys upload:
 *   fixtures/bills/*.jpg        synthetic bill + ledger photos (rendered HTML)
 *   fixtures/voice/*.wav        a voiced burst followed by silence (trips the VAD)
 *   fixtures/import/*.csv|xlsx  good file, file with bad rows, Hindi product names
 *
 * Run: npx tsx scripts/make-fixtures.ts
 */
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'

const F = path.resolve(__dirname, '..', 'fixtures')
for (const d of ['bills', 'voice', 'import']) fs.mkdirSync(path.join(F, d), { recursive: true })

// ─── WAV: 0.4s silence, 1.4s voiced burst, 1.6s silence (16 kHz mono PCM) ──
function wav(file: string) {
  const rate = 16000
  const seg = (sec: number) => Math.round(sec * rate)
  const total = seg(0.4) + seg(1.4) + seg(1.6)
  const data = Buffer.alloc(total * 2)
  for (let i = 0; i < total; i++) {
    let v = 0
    if (i >= seg(0.4) && i < seg(0.4) + seg(1.4)) {
      const t = i / rate
      // Vowel-like: a few harmonics with a slow amplitude wobble, plus noise.
      const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)
      v = env * (0.35 * Math.sin(2 * Math.PI * 180 * t) + 0.2 * Math.sin(2 * Math.PI * 360 * t) + 0.1 * Math.sin(2 * Math.PI * 720 * t)) + 0.05 * (Math.random() - 0.5)
    }
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  fs.writeFileSync(file, Buffer.concat([h, data]))
}
wav(path.join(F, 'voice', 'speech-burst.wav'))

// ─── Import files ───────────────────────────────────────────────────────
const goodRows = [
  ['Item Name', 'Brand', 'Category', 'Unit', 'Purchase Price', 'MRP', 'GST %'],
  ['Aashirvaad Atta 5kg', 'Aashirvaad', 'Staples', 'piece', '210', '245', '5'],
  ['Fortune Sunflower Oil 1L', 'Fortune', 'Oils', 'litre', '118', '135', '5'],
  ['Tata Salt 1kg', 'Tata', 'Staples', 'piece', '22', '28', '0'],
  ['Parle-G 800g', 'Parle', 'Biscuits', 'piece', '72', '85', '18'],
  ['Maggi Noodles 280g', 'Nestle', 'Instant Food', 'piece', '44', '52', '12'],
  ['Surf Excel 1kg', 'HUL', 'Detergent', 'piece', '118', '140', '18'],
  ['Colgate Strong Teeth 200g', 'Colgate', 'Personal Care', 'piece', '96', '112', '18'],
  ['Red Label Tea 500g', 'Brooke Bond', 'Beverages', 'piece', '228', '265', '5'],
  ['Amul Butter 100g', 'Amul', 'Dairy', 'piece', '52', '58', '12'],
  ['Dettol Soap 125g', 'Dettol', 'Personal Care', 'piece', '42', '50', '18'],
  ['Toor Dal 1kg', '', 'Pulses', 'kg', '128', '150', '0'],
  ['Basmati Rice 5kg', 'India Gate', 'Staples', 'piece', '520', '610', '5'],
  ['Haldiram Bhujia 400g', 'Haldiram', 'Snacks', 'piece', '88', '105', '12'],
  ['Good Day Cashew 200g', 'Britannia', 'Biscuits', 'piece', '36', '45', '18'],
  ['Clinic Plus 340ml', 'HUL', 'Personal Care', 'piece', '150', '178', '18'],
  ['Everest Garam Masala 100g', 'Everest', 'Spices', 'piece', '68', '82', '5'],
  ['Kissan Ketchup 950g', 'Kissan', 'Sauces', 'piece', '118', '140', '12'],
  ['Vim Bar 300g', 'HUL', 'Detergent', 'piece', '26', '32', '18'],
  ['Lizol Floor Cleaner 975ml', 'Reckitt', 'Detergent', 'piece', '178', '209', '18'],
  ['Sugar 1kg', '', 'Staples', 'kg', '40', '46', '5'],
]
const toCsv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n') + '\n'
fs.writeFileSync(path.join(F, 'import', 'products-good-20.csv'), toCsv(goodRows))

const badRows = [
  goodRows[0],
  ['Bourbon 150g', 'Britannia', 'Biscuits', 'piece', '28', '35', '18'],
  ['', 'NoName', 'Misc', 'piece', '10', '12', '5'], // missing name
  ['Kurkure 90g', 'PepsiCo', 'Snacks', 'piece', 'abc', '20', '12'], // non-numeric cost
  ['Bad GST Item', 'X', 'Misc', 'piece', '10', '12', '99'], // invalid GST slab
  ['Rs formatted item', 'Y', 'Misc', 'piece', 'Rs. 1,250', '₹1,499.00', '18'], // Indian money format
  ['Negative price item', 'Z', 'Misc', 'piece', '-5', '-2', '5'],
  ['Moong Dal 1kg', '', 'Pulses', 'kg', '118', '140', '0'],
]
fs.writeFileSync(path.join(F, 'import', 'products-bad-rows.csv'), toCsv(badRows))

const hindiRows = [
  ['उत्पाद', 'Brand', 'Category', 'Unit', 'खरीद मूल्य', 'बिक्री मूल्य', 'GST %'],
  ['आटा 5 किलो', 'आशीर्वाद', 'Staples', 'piece', '210', '245', '5'],
  ['चीनी 1 किलो', '', 'Staples', 'kg', '40', '46', '5'],
  ['सरसों का तेल 1 लीटर', 'Fortune', 'Oils', 'litre', '150', '175', '5'],
  ['पारले-जी बिस्किट', 'Parle', 'Biscuits', 'piece', '9', '10', '18'],
  ['मूंग दाल 1 किलो', '', 'Pulses', 'kg', '118', '140', '0'],
]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hindiRows), 'Products')
XLSX.writeFile(wb, path.join(F, 'import', 'products-hindi.xlsx'))
const wb2 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(goodRows.slice(0, 8)), 'Sheet1')
XLSX.writeFile(wb2, path.join(F, 'import', 'products-good-7.xlsx'))

// ─── Bill photos ───────────────────────────────────────────────────────
const billHtml = (title: string, lines: string[][], foot: string, hand = false) => `
<html><body style="margin:0;background:#d8d2c4;display:flex;align-items:center;justify-content:center;height:1000px">
<div style="width:620px;background:#fffef6;padding:36px;font-family:${hand ? "'Segoe Print','Comic Sans MS',cursive" : "'Courier New',monospace"};
 transform:rotate(-1.5deg);box-shadow:0 8px 30px rgba(0,0,0,.35);color:#222">
<h2 style="text-align:center;margin:0 0 6px">${title}</h2>
<p style="text-align:center;margin:0 0 18px;font-size:14px">GSTIN 36AABCS1429B1ZB · Hyderabad</p>
<table style="width:100%;font-size:18px;border-collapse:collapse">
${lines.map((l) => `<tr>${l.map((c, i) => `<td style="padding:6px 4px;border-bottom:1px dashed #999;${i ? 'text-align:right' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</table>
<p style="text-align:right;font-size:22px;font-weight:bold;margin-top:18px">${foot}</p></div></body></html>`

async function bills() {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 800, height: 1000 } })
  const shots: Array<[string, string]> = [
    ['supplier-bill-1.jpg', billHtml('SRI BALAJI TRADERS', [['Item', 'Qty', 'Rate', 'Amt'], ['PARLE-G 800G', '10', '72.00', '720.00'], ['TATA SALT', '', '', ''], ['THUMS UP 1L', '6', '', ''], ['MAGGI 280G', '12', '', ''], ['Haldiram Aloo Bhujia 400g', '4', '95.00', '380.00']], 'TOTAL Rs. 1,814.00 only')],
    ['supplier-bill-2.jpg', billHtml('LAXMI AGENCIES', [['Item', 'Qty', 'Rate', 'Amt'], ['SURF EXCEL 1KG', '5', '118', '590'], ['VIM BAR', '10', '26', '260']], 'TOTAL ₹850')],
    ['supplier-bill-3.jpg', billHtml('GANESH DISTRIBUTORS', [['Item', 'Qty', 'Rate', 'Amt'], ['AMUL BUTTER 100G', '20', '52', '1040']], 'TOTAL ₹1,040')],
    ['ledger-page.jpg', billHtml('खाता - 14/10', [['Ramesh bhai - doodh', '240'], ['Sita ben udhaar', '1150'], ['Chai patti 250g  3 x 120', '360'], ['Kiran store', '560']], 'कुल 2310', true)],
  ]
  for (const [name, html] of shots) {
    await p.setContent(html)
    await p.screenshot({ path: path.join(F, 'bills', name), type: 'jpeg', quality: 80 })
  }
  await b.close()
}

bills().then(() => console.log('fixtures written to', F))
