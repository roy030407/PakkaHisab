/**
 * Journey 12: transaction history; edit and delete a transaction.
 * The history page offers Void (soft delete); hard Delete lives in the
 * customer ledger. There is no edit flow; the journey checks for one.
 */
import { test, expect } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import { merchant, listProducts, setStock, stockOf, createCustomer, customerBalance } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

test('J12 transactions', async ({ page }, info) => {
  const j = new Journey('j12-transactions', page, info)
  await mockInsightOnly(page)
  await merchant(page, 'txn')
  const [p1] = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))
  await setStock(page.request, p1.id, 30)
  const cust = await createCustomer(page.request, 'Void Test Cust', '9000022222')
  const post = async (data: unknown) => (await (await page.request.post('/api/entry/quick', { data })).json()).transactionId as string
  const cashSale = await post({ type: 'sale', paymentMethod: 'cash', items: [{ productId: p1.id, quantity: 4 }] })
  const creditSale = await post({ type: 'sale', paymentMethod: 'credit', customerId: cust.id, items: [{ productId: p1.id, quantity: 2 }] })
  void cashSale
  const stockAfterSales = await stockOf(page.request, p1.id)

  await j.step('history shows today\'s transactions with a net total', async () => {
    await page.goto('/transactions')
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
    await expect(page.getByText(/2 transactions/)).toBeVisible({ timeout: 30_000 })
  })

  await j.step('previous/next day and calendar controls', async () => {
    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(page.getByText(/No transactions on/)).toBeVisible()
    await page.getByRole('button', { name: 'Next day' }).click()
    await expect(page.getByText(/2 transactions/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled()
  })

  await j.step('expand a row shows line items', async () => {
    await page.getByRole('button', { name: /sale/i }).filter({ hasText: 'cash' }).first().click()
    await expect(page.getByText(new RegExp(`4 x ${p1.name.slice(0, 10)}`))).toBeVisible()
  })

  await j.step('edit a transaction (qty / price / payment)', async () => {
    const edit = page.getByRole('button', { name: /edit/i })
    assert(await edit.count() > 0, 'No edit action on a transaction. A wrong qty or price can only be fixed by voiding and re-entering the sale.')
  })

  await j.step('void the credit sale (confirm step) restores stock and udhaar', async () => {
    const balBefore = await customerBalance(page.request, cust.id)
    await page.getByRole('button', { name: /sale/i }).filter({ hasText: 'Void Test Cust' }).first().click()
    await page.getByRole('button', { name: 'Void' }).click()
    await expect(page.getByText('Stock will be restored. Void?')).toBeVisible()
    await page.getByRole('button', { name: 'Yes, void' }).click()
    await expect(page.getByText(/1 transactions/)).toBeVisible({ timeout: 30_000 })
    const st = await stockOf(page.request, p1.id)
    const bal = await customerBalance(page.request, cust.id)
    assert(st === (stockAfterSales ?? 0) + 2, `stock ${stockAfterSales} -> ${st}`)
    assert(bal === balBefore - 2 * Number(p1.selling_price), `balance ${balBefore} -> ${bal}`)
    void creditSale
  })

  await j.step('"Voided" filter reveals the voided row', async () => {
    await page.getByLabel('Voided').check()
    await expect(page.getByText('Voided', { exact: true }).nth(1)).toBeVisible()
  })

  await j.step('voided sale is excluded from the dashboard and reports', async () => {
    const r = await (await page.request.get('/api/reports?period=daily')).json()
    const exp = 4 * Number(p1.selling_price)
    assert(Number(r.sales) === exp, `daily report sales ₹${r.sales}, expected ₹${exp}`)
  })

  await j.step('dashboard recent transactions list', async () => {
    await page.goto('/dashboard')
    await expect(page.locator('body')).not.toContainText('NaN')
  })

  j.save()
})
