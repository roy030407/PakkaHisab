/**
 * Journey 5: ledger (khata page) capture: photo -> parsed entries + day total.
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { Journey, assert } from '../helpers/journey'
import { merchant } from '../helpers/session'
import { mockScan, ledgerPageFixture, mockInsightOnly } from '../helpers/mocks'

const BILLS = path.resolve(__dirname, '..', 'fixtures', 'bills')

test('J5 ledger capture', async ({ page }, info) => {
  const j = new Journey('j05-ledger', page, info)
  await mockInsightOnly(page)
  await merchant(page, 'ledger')
  const fx = ledgerPageFixture()
  await mockScan(page, [fx])

  await j.step('ledger page is reachable from navigation', async () => {
    await page.goto('/dashboard')
    const link = page.locator('a[href="/ledger"]')
    const n = await link.count()
    assert(n > 0, 'No link to /ledger anywhere on the dashboard or nav. The khata capture screen is only reachable by typing the URL.')
  })

  await j.step('ledger idle screen', async () => {
    await page.goto('/ledger')
    await expect(page.getByText('Scan your khata')).toBeVisible()
  })

  await j.step('photo -> parsed entries', async () => {
    await page.locator('input[type="file"][capture]').setInputFiles(path.join(BILLS, 'ledger-page.jpg'))
    await expect(page.getByText("Today's total from your ledger")).toBeVisible({ timeout: 60_000 })
    for (const n of ['Ramesh bhai - doodh', 'Sita ben udhaar', 'Chai patti 250g', 'Kiran store']) await expect(page.getByText(n)).toBeVisible()
  })

  await j.step('day total equals the sum of line totals (3 x 120 row counted as 360)', async () => {
    const shown = Number((await page.locator('p.text-3xl').innerText()).replace(/[^0-9.]/g, ''))
    assert(shown === fx.expectedDayTotal, `Day total shows ₹${shown}; line totals add to ₹${fx.expectedDayTotal}. The page uses unitPrice before totalPrice, so "Chai patti 3 x 120" counts as ₹120.`)
  })

  await j.step('uncheck an entry and fix a misread amount', async () => {
    await page.getByRole('button', { name: 'Remove this entry' }).first().click()
    await expect(page.getByText(/· 1 removed/)).toBeVisible()
    await page.getByLabel('Amount for Kiran store').fill('600')
    const shown = Number((await page.locator('p.text-3xl').innerText()).replace(/[^0-9.]/g, ''))
    return `total after edits ₹${shown}`
  })

  await j.step('ledger entries can be saved to the books', async () => {
    const save = page.getByRole('button', { name: /save|add to/i })
    assert(await save.count() > 0, 'The only action is "Scan another page". Parsed khata entries and the day total are never saved; leaving the screen loses them.')
  })

  await j.step('ledger checkbox tap target size', async () => {
    const b = await page.getByRole('button', { name: /this entry/ }).first().boundingBox()
    assert(b && b.width >= 44 && b.height >= 44, `ledger include/exclude checkbox is ${b?.width}x${b?.height}px`)
  })

  j.save()
})
