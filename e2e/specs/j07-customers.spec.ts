/**
 * Journey 7: customers and udhaar.
 *   create customer, credit sale, aging, receive partial payment,
 *   reminder template edit, reminder wa.me link.
 */
import { test, expect } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import { merchant, listProducts, customerBalance, captureOutbound, captured } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

test('J7 customers + udhaar', async ({ page }, info) => {
  const j = new Journey('j07-customers', page, info)
  await mockInsightOnly(page)
  await captureOutbound(page)
  const { store } = await merchant(page, 'cust', { seed: true, name: 'Audit D Udhaar Store' })
  const [p1] = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))

  await j.step('customers empty state', async () => {
    await page.goto('/customers')
    await expect(page.getByText('No customers yet')).toBeVisible()
  })

  await j.step('customers page has an "Add customer" action', async () => {
    const add = page.getByRole('button', { name: /add customer|new customer|\+ customer/i })
    assert(await add.count() > 0, 'No way to add a customer from /customers. A regular udhaar customer can only be created from inside a sale.')
  })

  let custId = ''
  await j.step('create customer inline during a credit sale', async () => {
    await page.goto('/entry')
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: `Increase ${p1.name}` }).click()
    await page.getByRole('button', { name: '+ Add customer (optional)' }).click()
    await page.getByRole('button', { name: 'On credit (pay later)' }).click()
    await page.getByRole('button', { name: '+ New customer' }).click()
    await page.getByPlaceholder('Customer name').fill('Sita Ben')
    await page.getByPlaceholder('Phone (optional)').fill('98480 22334')
    const created = page.waitForResponse((r) => r.url().endsWith('/api/customers') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Save & select' }).click()
    custId = (await (await created).json()).customer.id
    await expect(page.getByText('✓ Customer added')).toBeVisible()
    await page.getByRole('button', { name: /Save sale/ }).click()
    await expect(page.getByText(/Sale saved - ₹/)).toBeVisible()
    // Let the auto-dismiss pass without touching the toggle.
    await page.getByRole('button', { name: 'Done' }).click()
  })

  const saleAmt = 4 * Number(p1.selling_price)
  await j.step('credit sale raised the balance', async () => {
    const bal = await customerBalance(page.request, custId)
    assert(bal === saleAmt, `balance ₹${bal}, expected ₹${saleAmt}`)
  })

  await j.step('udhaar tab lists the customer with total and aging line', async () => {
    await page.goto('/customers?tab=udhaar')
    await expect(page.getByRole('button', { name: new RegExp(`Udhaar due · ₹${saleAmt.toLocaleString('en-IN')}`) })).toBeVisible()
    await expect(page.getByText(/Balance since 0 din · never paid/)).toBeVisible()
  })

  await j.step('aging buckets (0-30 / 31-60 / 60+ days) are shown', async () => {
    const buckets = page.getByText(/0.?30|31.?60|60\+|90\+/)
    assert(await buckets.count() > 0, 'Aging is a single "Balance since N din" line per customer. There are no bucket groupings or totals (0-30 / 31-60 / 60+).')
  })

  await j.step('reminder link with default template', async () => {
    await page.getByRole('button', { name: 'Remind' }).first().click()
    const c = await captured(page)
    const url = c.opened.at(-1) ?? ''
    assert(url.startsWith('https://wa.me/919848022334?text='), url)
    const text = decodeURIComponent(url.split('?text=')[1])
    assert(text.includes('Sita Ben') && text.includes(saleAmt.toLocaleString('en-IN')) && text.includes(store.name), text)
    return text
  })

  await j.step('receive partial payment (Half)', async () => {
    await page.getByRole('button', { name: '+ Receive payment' }).first().click()
    await page.getByRole('button', { name: 'Half' }).click()
    await page.getByRole('button', { name: /Save|Record|Receive/ }).last().click()
    await expect(page.getByRole('button', { name: new RegExp(`Udhaar due · ₹${(saleAmt / 2).toLocaleString('en-IN')}`) })).toBeVisible({ timeout: 30_000 })
    const bal = await customerBalance(page.request, custId)
    assert(bal === saleAmt / 2, `balance ₹${bal}, expected ₹${saleAmt / 2}`)
  })

  await j.step('aging line now shows "last paid 0 din ago"', async () => {
    await expect(page.getByText(/last paid 0 din ago/)).toBeVisible()
  })

  await j.step('overpayment is blocked or clearly handled', async () => {
    await page.getByRole('button', { name: '+ Receive payment' }).first().click()
    await page.getByPlaceholder('0').first().fill(String(saleAmt * 3))
    await page.getByRole('button', { name: /Save|Record|Receive/ }).last().click()
    await page.waitForTimeout(1500)
    const bal = await customerBalance(page.request, custId)
    const err = await page.locator('p.text-red-600').innerText().catch(() => '')
    if (bal < 0) throw new Error(`Paying ₹${saleAmt * 3} on a ₹${saleAmt / 2} balance drove the balance to ₹${bal} with no warning.`)
    return `balance ₹${bal}; message: ${err || '(none)'}`
  })

  await j.step('customer ledger shows the sale and the payment', async () => {
    await page.goto('/customers')
    await page.getByRole('button', { name: /Sita Ben/ }).click()
    await expect(page.getByText(/Payment received \+₹/).first()).toBeVisible()
    await expect(page.getByText('Sale', { exact: true }).or(page.getByText('sale', { exact: true })).first()).toBeVisible()
  })

  await j.step('edit the reminder template in Settings', async () => {
    await page.goto('/settings')
    const ta = page.locator('textarea')
    await ta.fill('Ram Ram {name}, {shop} ka hisab ₹{amount} baaki hai. - audit')
    await page.getByRole('button', { name: 'Save message' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()
  })

  await j.step('reminder link uses the edited template', async () => {
    await page.goto('/customers?tab=udhaar')
    const n = (await captured(page)).opened.length
    await page.getByRole('button', { name: 'Remind' }).first().click()
    const c = await captured(page)
    assert(c.opened.length === n + 1, 'no link opened')
    const text = decodeURIComponent(c.opened.at(-1)!.split('?text=')[1])
    assert(text.startsWith('Ram Ram Sita Ben,') && text.includes('- audit'), text)
    return text
  })

  await j.step('customer without phone: Remind explains what to do', async () => {
    await page.request.post('/api/customers', { data: { name: 'No Phone Wala', type: 'regular' } })
    // give them a balance via a credit sale through the API
    const cs = await (await page.request.get('/api/customers')).json()
    const np = cs.customers.find((c: { name: string }) => c.name === 'No Phone Wala')
    await page.request.post('/api/entry/quick', { data: { type: 'sale', paymentMethod: 'credit', customerId: np.id, items: [{ productId: p1.id, quantity: 1 }] } })
    await page.goto('/customers?tab=udhaar')
    const card = page.locator('div.rounded-xl', { hasText: 'No Phone Wala' })
    await card.getByRole('button', { name: 'Remind' }).click()
    await expect(card.getByText('Add a phone number to send a reminder.')).toBeVisible()
  })

  await j.step('customer phone can be added/edited from the app', async () => {
    await page.goto('/customers')
    await page.getByRole('button', { name: /No Phone Wala/ }).click()
    const edit = page.getByRole('button', { name: /edit|add phone/i })
    assert(await edit.count() > 0, 'Customer ledger has no edit control; the "Add a phone number" hint has nowhere to go.')
  })

  await j.step('delete the credit sale from the ledger reverses the balance', async () => {
    await page.goto('/customers')
    await page.getByRole('button', { name: /No Phone Wala/ }).click()
    await page.getByRole('button', { name: 'Delete transaction' }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No transactions yet')).toBeVisible({ timeout: 30_000 })
    const cs = await (await page.request.get('/api/customers')).json()
    const np = cs.customers.find((c: { name: string }) => c.name === 'No Phone Wala')
    assert(Number(np.current_balance) === 0, `balance after delete ₹${np.current_balance}`)
  })

  j.save()
})
