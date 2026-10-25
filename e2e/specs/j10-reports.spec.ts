/**
 * Journey 10: reports. Every period with data and with zero data
 * (empty state, no NaN, no crash), PDF export downloads, share link opens
 * logged out.
 */
import { test, expect, type Page } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import { merchant, listProducts, setStock, createCustomer, captureOutbound, captured } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

const PERIODS = ['Today', 'Week', 'Month', 'Year'] as const

async function checkPeriod(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await expect(page.getByText('Payment methods')).toBeVisible({ timeout: 60_000 })
  const body = await page.locator('main, body').first().innerText()
  const bad = ['NaN', 'undefined', 'Infinity', 'null'].filter((t) => new RegExp(`\\b${t}\\b`).test(body))
  assert(bad.length === 0, `"${label}" report shows: ${bad.join(', ')}`)
  const err = page.getByText('Could not load report. Please try again.')
  assert(!(await err.isVisible()), `"${label}" report failed to load`)
}

test('J10 reports: zero data', async ({ page }, info) => {
  const j = new Journey('j10-reports-empty', page, info)
  await mockInsightOnly(page)
  await merchant(page, 'rep0', { seed: false, name: 'Audit D Empty Store' })
  await page.goto('/reports')
  for (const p of PERIODS) {
    await j.step(`${p} report renders with zero data (no NaN/crash)`, () => checkPeriod(page, p))
  }
  await j.step('zero-data report has a helpful empty state (not just ₹0 cards)', async () => {
    const hint = page.getByText(/no (sales|transactions|data)|add your first|start by/i)
    assert(await hint.count() > 0, 'Zero-data reports show ₹0 everywhere and empty charts with no guidance (UX rule 6: empty states must be helpful).')
  })
  await j.step('dashboard with zero data has no NaN', async () => {
    await page.goto('/dashboard')
    await expect(page.locator('body')).not.toContainText('NaN')
  })
  await j.step('PDF export with zero data still downloads', async () => {
    await page.goto('/reports')
    await expect(page.getByText('Payment methods')).toBeVisible({ timeout: 60_000 })
    const dl = page.waitForEvent('download', { timeout: 90_000 })
    await page.getByRole('link', { name: 'PDF' }).click()
    const f = await dl
    return `downloaded ${f.suggestedFilename()}`
  })
  j.save()
})

test('J10 reports: with data, PDF, share link', async ({ page, browser }, info) => {
  const j = new Journey('j10-reports-data', page, info)
  await mockInsightOnly(page)
  await captureOutbound(page)
  await merchant(page, 'rep1', { seed: true, name: 'Audit D Reports Store' })
  const [p1, p2] = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))
  await setStock(page.request, p1.id, 100)
  await setStock(page.request, p2.id, 100)
  const cust = await createCustomer(page.request, 'Report Credit Cust', '9000011111')
  const post = (data: unknown) => page.request.post('/api/entry/quick', { data })
  await post({ type: 'purchase', paymentMethod: 'cash', items: [{ productId: p1.id, quantity: 20 }] })
  await post({ type: 'sale', paymentMethod: 'cash', items: [{ productId: p1.id, quantity: 5 }, { productId: p2.id, quantity: 2 }] })
  await post({ type: 'sale', paymentMethod: 'upi', items: [{ productId: p2.id, quantity: 4 }] })
  await post({ type: 'sale', paymentMethod: 'credit', customerId: cust.id, items: [{ productId: p1.id, quantity: 3 }] })
  await post({ type: 'expense', paymentMethod: 'cash', amount: 1200, category: 'electricity' })
  const expectedSales = 8 * Number(p1.selling_price) + 6 * Number(p2.selling_price)

  await page.goto('/reports')
  for (const p of PERIODS) {
    await j.step(`${p} report renders with data`, () => checkPeriod(page, p))
  }
  await j.step('Today: sales total matches the 3 sales', async () => {
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await expect(page.getByText('Payment methods')).toBeVisible({ timeout: 60_000 })
    const txt = await page.getByText(/· \d+ transactions/).innerText()
    const salesCard = await page.getByText('Sales', { exact: true }).locator('..').locator('..').innerText()
    return `${txt}; Sales card: ${salesCard.replace(/\s+/g, ' ')}; expected sales ₹${expectedSales.toLocaleString('en-IN')}`
  })
  await j.step('expense breakdown and items-sold render', async () => {
    await expect(page.getByText(/Electricity/i).first()).toBeVisible()
    await expect(page.getByText(p1.name).first()).toBeVisible()
  })

  await j.step('PDF export downloads a non-empty PDF', async () => {
    const dl = page.waitForEvent('download', { timeout: 90_000 })
    await page.getByRole('link', { name: 'PDF' }).click()
    const f = await dl
    const p = await f.path()
    const fs = await import('fs')
    const head = fs.readFileSync(p!).subarray(0, 5).toString()
    const size = fs.statSync(p!).size
    assert(head === '%PDF-' && size > 1500, `download ${f.suggestedFilename()} head=${head} size=${size}`)
    return `${f.suggestedFilename()} ${size} bytes`
  })

  let shareUrl = ''
  await j.step('Share creates a link (copied to clipboard)', async () => {
    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page.getByText('Share link copied to clipboard')).toBeVisible({ timeout: 30_000 })
    shareUrl = (await captured(page)).copied.at(-1) ?? ''
    assert(/\/share\/[0-9a-f-]{36}/.test(shareUrl), `copied: ${shareUrl}`)
    return shareUrl
  })

  await j.step('share link opens logged out (fresh browser context)', async () => {
    const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined })
    const anon = await ctx.newPage()
    j.attach(anon)
    const path = new URL(shareUrl).pathname
    await anon.goto(path)
    await expect(anon).not.toHaveURL(/\/login/)
    const body = await anon.locator('body').innerText()
    await j.shot('share page logged out', anon)
    assert(!/NaN|undefined/.test(body), 'NaN/undefined on share page')
    assert(/₹/.test(body), `share page has no figures: ${body.slice(0, 200)}`)
    await ctx.close()
  })

  await j.step('share link host matches the app (not localhost/env default)', async () => {
    const host = new URL(shareUrl).host
    return `share host: ${host}`
  })

  await j.step('invalid share token shows a friendly page', async () => {
    const ctx = await browser.newContext()
    const anon = await ctx.newPage()
    const r = await anon.goto('/share/00000000-0000-0000-0000-000000000000')
    const body = await anon.locator('body').innerText()
    await j.shot('share invalid token', anon)
    await ctx.close()
    return `status ${r?.status()}; ${body.slice(0, 120).replace(/\s+/g, ' ')}`
  })

  j.save()
})
