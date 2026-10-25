/**
 * Journey 4: bill scan with mocked extraction.
 *   single photo, batch upload, confidence badges, edit a line, + Add new size,
 *   qty/price ambiguity prompt, duplicate warning, save as Purchase, save as
 *   Sale to a customer; then verify stock and customer balance moved correctly.
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { Journey, assert } from '../helpers/journey'
import {
  merchant, listProducts, addProduct, stockOf, setStock, createCustomer, customerBalance,
  captureOutbound, type ApiProduct,
} from '../helpers/session'
import { mockScan, supplierBillFixture, mockInsightOnly } from '../helpers/mocks'

const BILLS = path.resolve(__dirname, '..', 'fixtures', 'bills')

test('J4 scan', async ({ page }, info) => {
  const j = new Journey('j04-scan', page, info)
  await mockInsightOnly(page)
  await captureOutbound(page)
  await merchant(page, 'scan')

  const all = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))
  const [clean, guessed, ambiguous] = all
  const parent = await addProduct(page.request, { name: 'Thums Up', sellingPrice: 45, purchasePrice: 38, category: 'Beverages' })
  const v1 = await addProduct(page.request, { name: 'Thums Up 750ml', sellingPrice: 45, purchasePrice: 38, parentProductId: parent.id, category: 'Beverages' })
  const v2 = await addProduct(page.request, { name: 'Thums Up 2L', sellingPrice: 95, purchasePrice: 80, parentProductId: parent.id, category: 'Beverages' })
  for (const p of [clean, guessed, ambiguous]) await setStock(page.request, p.id, 20)
  const before = {
    clean: await stockOf(page.request, clean.id),
    guessed: await stockOf(page.request, guessed.id),
    ambiguous: await stockOf(page.request, ambiguous.id),
  }
  j.note('stock before', JSON.stringify(before))

  const fx = (vendor: string, dup: { id: string; date: string } | null = null) =>
    supplierBillFixture({ clean, guessed, ambiguous, variants: [v1, v2] as ApiProduct[] }, { vendorName: vendor, duplicateOf: dup })
  const bill1 = fx('Sri Balaji Traders')
  const scanLog = await mockScan(page, [bill1])

  await j.step('scan page loads with Camera / Gallery / Upload options', async () => {
    await page.goto('/scan')
    await expect(page.getByText('Scan a bill')).toBeVisible()
    await expect(page.getByText('Upload file (PDF or image)')).toBeVisible()
  })

  await j.step('"Upload file (PDF or image)" actually accepts a PDF', async () => {
    const accept = await page.locator('input[type="file"]').nth(2).getAttribute('accept')
    assert(accept?.includes('pdf'), `Label says "PDF or image" but the input accept is "${accept}" and /api/scan rejects application/pdf.`)
  })

  await j.step('single photo upload shows loading then the review screen', async () => {
    await page.locator('input[type="file"][capture]').setInputFiles(path.join(BILLS, 'supplier-bill-1.jpg'))
    await expect(page.getByText(/Save (sale|purchase)|Resolve highlighted items/)).toBeVisible({ timeout: 60_000 })
  })

  await j.step('review defaults to Purchase for a supplier bill with a vendor name', async () => {
    const saleActive = await page.getByRole('button', { name: 'Sale', exact: true }).evaluate((b) => b.className.includes('bg-white'))
    assert(!saleActive, 'A supplier bill from "Sri Balaji Traders" opens as a SALE. One careless tap on Save would decrease stock instead of increasing it, and the vendor name is hidden behind the Purchase toggle.')
  })

  await j.step('confidence badges: "⚠ check" on guessed / unresolved rows, none on the clean match', async () => {
    const badges = await page.getByText('⚠ check').count()
    await expect(page.getByText('✓ matched - read from bill')).toBeVisible()
    assert(badges >= 3, `only ${badges} "⚠ check" badges for 4 uncertain rows`)
    return `${badges} badges`
  })

  await j.step('save is blocked while a size choice / qty-price question is open', async () => {
    await expect(page.getByRole('button', { name: 'Resolve highlighted items to save' })).toBeDisabled()
  })

  await j.step('qty/price ambiguity prompt: "Is 12 the quantity or the price?" -> Quantity', async () => {
    await expect(page.getByText(/is the quantity or the price\?/)).toBeVisible()
    await page.getByRole('button', { name: 'Quantity (12)' }).click()
    await expect(page.getByLabel(`Quantity for ${ambiguous.name}`)).toHaveValue('12')
  })

  await j.step('size choice row offers + Add new size', async () => {
    await expect(page.getByText('Which size? Or add the size on the bill as a new one.')).toBeVisible()
    await expect(page.getByRole('button', { name: /\+ Add .*THUMS UP 1L.* as new/ })).toBeVisible()
  })

  await j.step('tap "+ Add THUMS UP 1L as new"', async () => {
    await page.getByRole('button', { name: /\+ Add .*THUMS UP 1L.* as new/ }).click()
    await expect(page.getByText('Will be added as a new product.').first()).toBeVisible()
  })

  await j.step('new-size row price is 0 after "Add as new" (merchant must notice)', async () => {
    const v = await page.getByLabel('Price for THUMS UP 1L').inputValue()
    return `price input = ${v}`
  })

  await j.step('edit a line: rename + change price + bump qty', async () => {
    await page.getByLabel('Price for THUMS UP 1L').fill('70')
    await page.getByRole('button', { name: 'Increase quantity for THUMS UP 1L' }).click()
    await expect(page.getByLabel('Quantity for THUMS UP 1L')).toHaveValue('7')
    const nameInputs = page.getByLabel('Product name')
    await nameInputs.nth(2).fill('Thums Up 1L')
  })

  await j.step('switch to Purchase, vendor prefilled from the bill', async () => {
    await page.getByRole('button', { name: 'Purchase', exact: true }).click()
    await expect(page.getByPlaceholder('Unknown vendor')).toHaveValue('Sri Balaji Traders')
  })

  let purchaseSaved = false
  await j.step('save as Purchase', async () => {
    const resp = page.waitForResponse((r) => r.url().includes('/api/scan/confirm'))
    await page.getByRole('button', { name: /Save purchase/ }).click()
    const r = await resp
    assert(r.ok(), `/api/scan/confirm ${r.status()} ${await r.text()}`)
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
    purchaseSaved = true
  })

  await j.step('stock increased for every purchased line', async () => {
    assert(purchaseSaved, 'purchase not saved')
    const after = {
      clean: await stockOf(page.request, clean.id),
      guessed: await stockOf(page.request, guessed.id),
      ambiguous: await stockOf(page.request, ambiguous.id),
    }
    const exp = { clean: (before.clean ?? 0) + 10, guessed: (before.guessed ?? 0) + 1, ambiguous: (before.ambiguous ?? 0) + 12 }
    assert(JSON.stringify(after) === JSON.stringify(exp), `stock after ${JSON.stringify(after)}, expected ${JSON.stringify(exp)}`)
  })

  await j.step('new products created from the bill ("Thums Up 1L", "Haldiram Aloo Bhujia 400g")', async () => {
    const prods = await listProducts(page.request)
    const tu = prods.find((p) => p.name === 'Thums Up 1L')
    const hb = prods.find((p) => /Haldiram Aloo Bhujia/i.test(p.name))
    assert(tu && hb, `found Thums Up 1L=${!!tu}, Haldiram=${!!hb}`)
    const tuStock = await stockOf(page.request, tu!.id)
    return `Thums Up 1L stock ${tuStock}, parent=${tu!.parent_product_id ?? 'none (not linked as a variant of Thums Up)'}; purchase ${tu!.purchase_price}, selling ${tu!.selling_price}`
  })

  // ─── Duplicate warning: rescan the same bill (same vendor + total) ───
  await j.step('duplicate warning when the same bill is scanned again', async () => {
    const tx = await (await page.request.get('/api/transactions')).json()
    const prev = (tx.transactions ?? tx.rows ?? []).find((t: { vendor_name?: string; vendorName?: string }) => (t.vendor_name ?? t.vendorName) === 'Sri Balaji Traders')
    await page.unroute('**/api/scan')
    await mockScan(page, [fx('Sri Balaji Traders', { id: prev?.id ?? 'x', date: new Date().toISOString() })])
    await page.goto('/scan')
    await page.locator('input[type="file"][capture]').setInputFiles(path.join(BILLS, 'supplier-bill-1.jpg'))
    await expect(page.getByText('Possible duplicate')).toBeVisible({ timeout: 60_000 })
    return 'UI renders the warning (server-side duplicate rule is behind the mocked AI call, not exercised here)'
  })

  await j.step('dismiss duplicate and discard the scan', async () => {
    await page.getByText('Possible duplicate').locator('..').locator('..').getByRole('button', { name: '✕' }).click()
    await expect(page.getByText('Possible duplicate')).toBeHidden()
    await page.getByRole('button', { name: 'Discard this scan' }).click()
    await expect(page.getByText('Scan a bill')).toBeVisible()
  })

  // ─── Sale to a customer ───
  const cust = await createCustomer(page.request, 'Audit Scan Customer', '9988776655')
  const balBefore = await customerBalance(page.request, cust.id)
  const cleanBeforeSale = await stockOf(page.request, clean.id)
  await page.unroute('**/api/scan')
  const saleFx = fx('Counter sale')
  // Make it a simple 2-line sale: the clean match and the guessed line.
  saleFx.extraction.items = saleFx.extraction.items.slice(0, 2)
  saleFx.extraction.items[0].quantity = 3
  saleFx.extraction.items[0].unitPrice = Number(clean.selling_price)
  await mockScan(page, [saleFx])

  let saleTotal = 0
  await j.step('scan -> Sale to a customer on credit', async () => {
    await page.goto('/scan')
    await page.locator('input[type="file"][capture]').setInputFiles(path.join(BILLS, 'supplier-bill-3.jpg'))
    await expect(page.getByRole('button', { name: /Save sale/ })).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: '+ Add customer (optional)' }).click()
    await page.getByRole('button', { name: 'On credit (pay later)' }).click()
    await page.getByPlaceholder('Search customers...').fill(cust.name)
    await page.getByRole('button', { name: new RegExp(cust.name) }).click()
    await expect(page.getByText('✓ Customer added')).toBeVisible()
    const label = await page.getByRole('button', { name: /Save sale/ }).innerText()
    saleTotal = Number(label.replace(/[^0-9.]/g, ''))
    const resp = page.waitForResponse((r) => r.url().includes('/api/scan/confirm'))
    await page.getByRole('button', { name: /Save sale/ }).click()
    const r = await resp
    assert(r.ok(), `/api/scan/confirm ${r.status()}`)
    await expect(page.getByText('Sale saved')).toBeVisible()
  })

  await j.step('customer balance rose by the sale total; stock fell by 3', async () => {
    const bal = await customerBalance(page.request, cust.id)
    const st = await stockOf(page.request, clean.id)
    assert(bal - balBefore === saleTotal, `balance ${balBefore} -> ${bal}, sale total ${saleTotal}`)
    assert(st === (cleanBeforeSale ?? 0) - 3, `stock ${cleanBeforeSale} -> ${st}, sold 3`)
  })

  await j.step('WhatsApp receipt after scanned sale uses wa.me/91...', async () => {
    await page.getByRole('button', { name: 'Share receipt on WhatsApp' }).click()
    await page.waitForFunction(() => (window as unknown as { __opened: string[] }).__opened.length > 0, null, { timeout: 15_000 })
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.at(-1))
    assert(opened?.startsWith('https://wa.me/919988776655?text='), String(opened))
  })

  // ─── Batch upload ───
  await page.unroute('**/api/scan')
  const b1 = fx('Batch Vendor A'); b1.extraction.items = b1.extraction.items.slice(0, 1)
  const b2 = fx('Batch Vendor B'); b2.extraction.items = b2.extraction.items.slice(4, 5)
  const b3 = fx('Batch Vendor C'); b3.extraction.items = b3.extraction.items.slice(1, 2)
  const batchLog = await mockScan(page, [b1, b2, b3])
  await j.step('batch: 3 gallery photos -> "Bill 1 of 3"', async () => {
    await page.goto('/scan')
    await page.locator('input[type="file"][multiple]').setInputFiles([
      path.join(BILLS, 'supplier-bill-1.jpg'), path.join(BILLS, 'supplier-bill-2.jpg'), path.join(BILLS, 'supplier-bill-3.jpg'),
    ])
    await expect(page.getByText('Bill 1 of 3')).toBeVisible({ timeout: 60_000 })
  })
  await j.step('batch: save bill 1 as purchase, advances to bill 2', async () => {
    await page.getByRole('button', { name: 'Purchase', exact: true }).click()
    await page.getByRole('button', { name: /Save purchase/ }).click()
    await expect(page.getByText('Bill 2 of 3')).toBeVisible({ timeout: 60_000 })
  })
  await j.step('batch: discard bill 2, advances to bill 3', async () => {
    await page.getByRole('button', { name: 'Discard this scan' }).click()
    await expect(page.getByText('Bill 3 of 3')).toBeVisible({ timeout: 60_000 })
  })
  await j.step('batch: Purchase/Sale choice persists between bills', async () => {
    const saleActive = await page.getByRole('button', { name: 'Sale', exact: true }).evaluate((b) => b.className.includes('bg-white'))
    assert(!saleActive, 'Bill 3 of 3 resets to Sale even though the merchant chose Purchase for bill 1 of a supplier batch.')
  })
  await j.step('batch: save bill 3, returns to dashboard', async () => {
    await page.getByRole('button', { name: 'Purchase', exact: true }).click()
    await page.getByRole('button', { name: /Save purchase/ }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
    assert(batchLog.count === 3, `scan called ${batchLog.count} times`)
  })

  await j.step('scan API error shows a plain-language error and Try again', async () => {
    await page.unroute('**/api/scan')
    await page.route('**/api/scan', (r) => r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'extraction_failed' }) }))
    await page.goto('/scan')
    await page.locator('input[type="file"][capture]').setInputFiles(path.join(BILLS, 'supplier-bill-2.jpg'))
    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 60_000 })
    const msg = await page.locator('p.text-sm.text-gray-500').first().innerText()
    assert(!/extraction_failed/.test(msg), `Merchant sees the raw error code "${msg}"`)
  })

  j.save({ scanCalls: scanLog.count })
})
