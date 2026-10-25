/**
 * Journey 3: Quick entry and Full entry, frequent-items strip, Cash/UPI
 * toggle after save, WhatsApp receipt link (asserted, never opened).
 */
import { test, expect } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import {
  merchant, listProducts, stockOf, setStock, createCustomer, customerBalance,
  captureOutbound, captured, todayIST,
} from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

test('J3 quick + full entry', async ({ page }, info) => {
  const j = new Journey('j03-entry', page, info)
  await mockInsightOnly(page)
  await captureOutbound(page)
  await merchant(page, 'entry')
  const prods = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))
  const [p1, p2] = prods
  for (const p of [p1, p2]) await setStock(page.request, p.id, 50)
  const s1Before = await stockOf(page.request, p1.id)

  await j.step('quick entry loads, Sale is the default type', async () => {
    await page.goto('/entry')
    await expect(page.getByText('Sale', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Increase ${p1.name}` })).toBeVisible({ timeout: 30_000 })
  })

  await j.step('frequent-items strip ("Most popular items") is shown', async () => {
    await expect(page.getByText('Most popular items')).toBeVisible({ timeout: 15_000 })
  })

  await j.step('+/- quantity and running total', async () => {
    await page.getByRole('button', { name: `Increase ${p1.name}` }).click()
    await page.getByRole('button', { name: `Increase ${p1.name}` }).click()
    await page.getByRole('button', { name: `Increase ${p1.name}` }).click()
    await page.getByRole('button', { name: `Decrease ${p1.name}` }).click()
    await page.getByRole('button', { name: `Increase ${p2.name}` }).click()
    const expected = 2 * Number(p1.selling_price) + Number(p2.selling_price)
    await expect(page.getByRole('button', { name: new RegExp(`Save sale · ₹${expected.toLocaleString('en-IN')}`) })).toBeVisible()
    return `total ₹${expected}`
  })

  await j.step('quick entry +/- tap targets are at least 44x44', async () => {
    const box = await page.getByRole('button', { name: `Increase ${p1.name}` }).boundingBox()
    assert(box && box.width >= 44 && box.height >= 44, `Quick-entry +/- buttons are ${box?.width}x${box?.height}px (w-7 h-7). Under the 44px minimum for the primary daily action.`)
  })

  let saleId = ''
  await j.step('save quick sale shows Cash/UPI toggle', async () => {
    const resp = page.waitForResponse((r) => r.url().includes('/api/entry/quick') && r.request().method() === 'POST')
    await page.getByRole('button', { name: /Save sale/ }).click()
    const r = await resp
    saleId = (await r.json()).transactionId
    await expect(page.getByText(/Sale saved - ₹/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cash', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'UPI', exact: true })).toBeVisible()
  })

  await j.step('tap Cash after save updates the payment method', async () => {
    const patch = page.waitForResponse((r) => r.url().includes(`/api/transactions/${saleId}`) && r.request().method() === 'PATCH')
    await page.getByRole('button', { name: 'Cash', exact: true }).click()
    await patch
    const tx = await (await page.request.get(`/api/transactions/${saleId}`)).json()
    assert(tx.transaction.payment_method === 'cash', `payment_method is ${tx.transaction.payment_method}`)
  })

  await j.step('stock decreased by the quantity sold', async () => {
    const after = await stockOf(page.request, p1.id)
    assert(s1Before !== null && after === s1Before - 2, `stock before ${s1Before}, after ${after}, sold 2`)
  })

  await j.step('Share receipt with no customer: falls back to clipboard (no wa.me link)', async () => {
    await page.getByRole('button', { name: 'Share receipt on WhatsApp' }).click()
    await expect(page.getByText('Receipt copied - paste it into WhatsApp.')).toBeVisible()
    const c = await captured(page)
    assert(c.opened.length === 0, `opened ${c.opened.join(', ')}`)
    return `copied text: ${JSON.stringify(c.copied.at(-1)?.slice(0, 160))}`
  })

  // Customer with phone, sale on cash: the WhatsApp link opens with +91 formatting.
  const phones = [
    { label: '10-digit with space', phone: '98765 43210', expect: '919876543210' },
    { label: '+91 with dash', phone: '+91 98765-43211', expect: '919876543211' },
    { label: 'leading 0 (11 digits)', phone: '09876543212', expect: '919876543212' },
  ]
  for (const ph of phones) {
    await j.step(`WhatsApp receipt link for phone "${ph.phone}" (${ph.label})`, async () => {
      const cust = await createCustomer(page.request, `Audit Cust ${ph.expect.slice(-2)}`, ph.phone)
      await page.goto('/entry')
      await page.getByRole('button', { name: `Increase ${p2.name}` }).click()
      await page.getByRole('button', { name: '+ Add customer (optional)' }).click()
      await page.getByPlaceholder('Search customers...').fill(cust.name)
      await page.getByRole('button', { name: new RegExp(cust.name) }).click()
      await page.getByRole('button', { name: /Save sale/ }).click()
      await expect(page.getByText(/Sale saved - ₹/)).toBeVisible()
      await page.getByRole('button', { name: 'Share receipt on WhatsApp' }).click()
      await page.waitForFunction(() => {
        const w = window as unknown as { __opened: string[]; __copied: string[] }
        return w.__opened.length + w.__copied.length > 0
      }, null, { timeout: 15_000 }).catch(() => {})
      const c = await captured(page)
      const url = c.opened.at(-1) ?? ''
      assert(url.startsWith(`https://wa.me/${ph.expect}?text=`), `expected wa.me/${ph.expect}, got ${url || '(no link; receipt copied to clipboard instead)'}`)
      const text = decodeURIComponent(url.split('?text=')[1] ?? '')
      assert(text.includes(p2.name) && /₹/.test(text), `receipt text missing item or ₹: ${text.slice(0, 200)}`)
      return `${url.slice(0, 40)}... text: ${JSON.stringify(text.slice(0, 120))}`
    })
  }

  await j.step('credit sale then tapping "Cash" on the post-save toggle keeps udhaar consistent', async () => {
    const cust = await createCustomer(page.request, 'Audit Credit Toggle', '9123456780')
    await page.goto('/entry')
    await page.getByRole('button', { name: `Increase ${p1.name}` }).click()
    await page.getByRole('button', { name: '+ Add customer (optional)' }).click()
    await page.getByRole('button', { name: 'On credit (pay later)' }).click()
    await page.getByPlaceholder('Search customers...').fill(cust.name)
    await page.getByRole('button', { name: new RegExp(cust.name) }).click()
    const resp = page.waitForResponse((r) => r.url().includes('/api/entry/quick'))
    await page.getByRole('button', { name: /Save sale/ }).click()
    const id = (await (await resp).json()).transactionId
    await expect(page.getByText(/Sale saved - ₹/)).toBeVisible()
    const balCredit = await customerBalance(page.request, cust.id)
    const upiHighlighted = await page.getByRole('button', { name: 'UPI', exact: true }).evaluate((b) => b.className.includes('bg-violet-600'))
    await page.getByRole('button', { name: 'Cash', exact: true }).click()
    await page.waitForResponse((r) => r.url().includes(`/api/transactions/${id}`) && r.request().method() === 'PATCH')
    const tx = (await (await page.request.get(`/api/transactions/${id}`)).json()).transaction
    const balAfter = await customerBalance(page.request, cust.id)
    const notes = `after credit save: balance ₹${balCredit}, toggle showed UPI highlighted=${upiHighlighted}; after tapping Cash: payment_method=${tx.payment_method}, balance ₹${balAfter}`
    assert(!(tx.payment_method === 'cash' && balAfter > 0), `Udhaar out of sync. ${notes}. The sale is now "cash" but the customer still owes the full amount.`)
    return notes
  })

  await j.step('expense via quick entry ("Recording something else?")', async () => {
    await page.goto('/entry')
    await page.getByRole('button', { name: 'Recording something else?' }).click()
    await page.getByRole('button', { name: 'Expense', exact: true }).click()
    await page.getByPlaceholder('0').fill('750')
    await page.getByRole('button', { name: 'Electricity' }).click()
    await page.getByPlaceholder('e.g. June shop rent').fill('Audit bijli bill')
    await page.getByRole('button', { name: /Save expense · ₹750/ }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
  })

  await j.step('full entry: switch from quick, items carry over', async () => {
    await page.goto('/entry')
    await page.getByRole('button', { name: `Increase ${p2.name}` }).click()
    await page.getByRole('button', { name: 'Switch to full entry' }).click()
    await expect(page.getByText(p2.name).first()).toBeVisible()
    await expect(page.getByText('1 item')).toBeVisible()
  })

  await j.step('full entry date defaults to today in IST', async () => {
    const v = await page.locator('input[type="date"]').inputValue()
    assert(v === todayIST(), `date input is ${v}, IST today is ${todayIST()} (form uses UTC toISOString)`)
  })

  await j.step('full entry: add product by fuzzy search, edit price, pick Cash', async () => {
    await page.getByPlaceholder('Add product...').fill(p1.name.slice(0, 5).toLowerCase())
    await page.getByRole('button', { name: new RegExp(p1.name.slice(0, 5), 'i') }).first().click()
    await expect(page.getByText('2 items')).toBeVisible()
    await page.getByRole('button', { name: 'Cash', exact: true }).click()
  })

  await j.step('full entry: selected customer label renders cleanly', async () => {
    const cust = await createCustomer(page.request, 'Audit Full Cust', '9000000001')
    await page.getByRole('button', { name: '+ Add customer (optional)' }).click()
    await page.getByPlaceholder('Search customers...').fill(cust.name)
    await page.getByRole('button', { name: new RegExp(cust.name) }).click()
    const label = await page.getByRole('button', { name: /Customer selected/ }).innerText()
    assert(!label.includes('&#'), `Button text is literally "${label}" (HTML entity inside a JS string)`)
  })

  await j.step('full entry: save sale and share link', async () => {
    await page.getByRole('button', { name: /Save sale/ }).click()
    await expect(page.getByText('Sale saved')).toBeVisible()
    await page.getByRole('button', { name: 'Share receipt on WhatsApp' }).click()
    await page.waitForTimeout(1500)
    const c = await captured(page)
    return `opened: ${c.opened.at(-1)?.slice(0, 60) ?? 'none'}; copied: ${c.copied.length}`
  })

  await j.step('full entry: expense without a product can be saved', async () => {
    await page.goto('/entry?mode=full')
    await page.locator('select').first().selectOption('expense')
    const save = page.getByRole('button', { name: /Save expense/ })
    assert(await save.isEnabled(), 'In Full mode, Expense/Income have no amount field and Save stays disabled until a product is added. A rent or salary expense cannot be recorded here.')
  })

  await j.step('full entry: switching Sale to Purchase reprices items', async () => {
    await page.goto('/entry?mode=full')
    await page.getByPlaceholder('Add product...').fill(p1.name.slice(0, 5))
    await page.getByRole('button', { name: new RegExp(p1.name.slice(0, 5), 'i') }).first().click()
    await page.locator('select').first().selectOption('purchase')
    const price = Number(await page.locator('input[type="number"]').first().inputValue())
    assert(price === Number(p1.purchase_price), `Item added as Sale at ₹${p1.selling_price}; after switching to Purchase it is still ₹${price} (purchase price is ₹${p1.purchase_price}).`)
  })

  j.save()
})
