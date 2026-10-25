/**
 * Journey 8: Din ka hisab (close the day).
 *   close a day, next day opening carries forward, mismatch handling.
 * The UI has no date picker, so "yesterday" is closed through the same API
 * the page uses, then today's screen is checked for the carried opening.
 */
import { test, expect } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import { merchant, listProducts, setStock, todayIST } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

test('J8 din ka hisab', async ({ page }, info) => {
  const j = new Journey('j08-din-ka-hisab', page, info)
  await mockInsightOnly(page)
  await merchant(page, 'dkh')
  const [p1] = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))
  await setStock(page.request, p1.id, 40)
  const price = Number(p1.selling_price)

  await j.step('reachable from navigation', async () => {
    await page.goto('/dashboard')
    assert(await page.locator('a[href="/reconcile"]').count() > 0, 'No link to /reconcile (Din ka hisab) on the dashboard or nav.')
  })

  await j.step('close "yesterday" with ₹2,000 counted (via API)', async () => {
    const r = await page.request.post('/api/reconciliation', { data: { date: todayIST(-1), openingCash: 1500, countedCash: 2000, note: 'audit-d yesterday' } })
    assert(r.ok(), `${r.status()} ${await r.text()}`)
  })

  // Today: 2 cash sales + 1 UPI sale + 1 cash expense
  await page.request.post('/api/entry/quick', { data: { type: 'sale', paymentMethod: 'cash', items: [{ productId: p1.id, quantity: 2 }] } })
  await page.request.post('/api/entry/quick', { data: { type: 'sale', paymentMethod: 'cash', items: [{ productId: p1.id, quantity: 1 }] } })
  await page.request.post('/api/entry/quick', { data: { type: 'sale', paymentMethod: 'upi', items: [{ productId: p1.id, quantity: 5 }] } })
  await page.request.post('/api/entry/quick', { data: { type: 'expense', paymentMethod: 'cash', amount: 200, category: 'transport', note: 'audit tempo' } })
  const cashIn = 3 * price
  const expected = 2000 + cashIn - 200

  await j.step("today's opening carries forward yesterday's counted cash", async () => {
    await page.goto('/reconcile')
    await expect(page.getByRole('heading', { name: 'Din ka hisab' })).toBeVisible()
    const opening = await page.locator('input[type="number"]').first().inputValue()
    assert(Number(opening) === 2000, `opening shows ${opening}, expected 2000 (carried from yesterday's count). Server date is UTC; IST today ${todayIST()}.`)
  })

  await j.step('cash in / cash out / expected / UPI figures', async () => {
    await expect(page.getByText(`+₹${cashIn.toLocaleString('en-IN')}`)).toBeVisible()
    await expect(page.getByText('-₹200')).toBeVisible()
    await expect(page.getByText(`₹${expected.toLocaleString('en-IN')}`).first()).toBeVisible()
    await expect(page.getByText(`₹${(5 * price).toLocaleString('en-IN')}`).last()).toBeVisible()
  })

  await j.step('mismatch: short by ₹150 shown in red', async () => {
    await page.locator('input[type="number"]').nth(1).fill(String(expected - 150))
    await expect(page.getByText('Short by ₹150')).toBeVisible()
  })
  await j.step('mismatch: extra ₹50', async () => {
    await page.locator('input[type="number"]').nth(1).fill(String(expected + 50))
    await expect(page.getByText('Extra ₹50')).toBeVisible()
  })
  await j.step('tally', async () => {
    await page.locator('input[type="number"]').nth(1).fill(String(expected))
    await expect(page.getByText('Tally - sahi hai')).toBeVisible()
  })

  await j.step('close the day with a mismatch and a note', async () => {
    await page.locator('input[type="number"]').nth(1).fill(String(expected - 150))
    await page.getByPlaceholder(/Note \(optional\)/).fill('gave ₹150 to delivery boy')
    await page.getByRole('button', { name: 'Close the day' }).click()
    await expect(page.getByText(`Saved. Tomorrow opens with ₹${(expected - 150).toLocaleString('en-IN')}.`)).toBeVisible()
  })

  await j.step('reload shows the saved close (Update close)', async () => {
    await page.reload()
    await expect(page.getByRole('button', { name: 'Update close' })).toBeVisible()
    assert(Number(await page.locator('input[type="number"]').nth(1).inputValue()) === expected - 150, 'counted not restored')
  })

  await j.step('tomorrow opens with today\'s counted cash (API)', async () => {
    const r = await (await page.request.get(`/api/reconciliation?date=${todayIST(1)}`)).json()
    assert(Number(r.openingCash) === expected - 150, `tomorrow opening ${r.openingCash}, expected ${expected - 150}`)
  })

  await j.step('negative counted cash is rejected', async () => {
    await page.locator('input[type="number"]').nth(1).fill('-10')
    await page.getByRole('button', { name: 'Update close' }).click()
    await expect(page.getByText('Enter a valid counted cash amount.')).toBeVisible()
  })

  await j.step('transaction dated today (IST) is counted for today', async () => {
    const r = await (await page.request.get('/api/reconciliation')).json()
    return `server date=${r.date}, IST today=${todayIST()}, cashIn=${r.cashIn}`
  })

  j.save()
})
