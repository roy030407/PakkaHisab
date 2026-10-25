/**
 * Journey 2: onboarding.
 *  - each store type (kirana, medical, hardware, restaurant, clothing) loads
 *    its sample catalog when "Yes, load sample data" is chosen
 *  - fixed costs, GST config
 *  - CSV / XLSX import wizard: good file, bad rows, Hindi product names
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { Journey, assert } from '../helpers/journey'
import { createConfirmedUser, uiLogin, listProducts, createStore } from '../helpers/session'
import { mockImportMap, mockInsightOnly } from '../helpers/mocks'

const TYPES: Array<{ key: string; label: string }> = [
  { key: 'kirana', label: 'Kirana / General Store' },
  { key: 'medical', label: 'Medical Shop / Pharmacy' },
  { key: 'hardware', label: 'Hardware Store' },
  { key: 'restaurant', label: 'Restaurant / Food' },
  { key: 'clothing', label: 'Clothing / Garments' },
]
const IMPORT = path.resolve(__dirname, '..', 'fixtures', 'import')

async function pollProducts(page: Page, min: number, ms = 30_000) {
  const until = Date.now() + ms
  let n = 0
  while (Date.now() < until) {
    n = (await listProducts(page.request)).length
    if (n >= min) return n
    await page.waitForTimeout(1500)
  }
  return n
}

for (const t of TYPES) {
  test(`J2 onboarding sample catalog: ${t.key}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'pixel7' && t.key !== 'kirana', 'store-type matrix runs once, on the primary mobile project')
    const j = new Journey(`j02-onboarding-${t.key}`, page, info)
    await mockInsightOnly(page)
    const u = await createConfirmedUser(`onb-${t.key}`)
    await uiLogin(page, u.email, u.password)
    await page.waitForURL(/\/onboarding/, { timeout: 90_000 })

    await j.step(`onboarding form shows the sample-store offer for ${t.key}`, async () => {
      await page.getByLabel('Store name').fill(`Audit D ${t.key}`)
      await page.getByRole('combobox').first().click()
      await page.getByRole('option', { name: t.label }).click()
      await expect(page.getByText('Would you like to start with a sample store?')).toBeVisible()
    })

    await j.step(`submit onboarding with sample data (${t.key})`, async () => {
      await page.getByRole('button', { name: 'Yes, load sample data' }).click()
      await page.getByLabel('Your name').fill('Audit Owner')
      await page.getByLabel('City').fill('Indore')
      await page.getByRole('button', { name: 'Get started' }).click()
      await page.waitForURL(/\/dashboard/, { timeout: 90_000 })
    })

    let count = 0
    await j.step(`sample catalog loaded for ${t.key}`, async () => {
      count = await pollProducts(page, 10)
      assert(count >= 10, `Only ${count} products after choosing "Yes, load sample data" for ${t.key}. Expected a sample catalog (~50-100 products).`)
      return `${count} products`
    })

    await j.step(`sample fixed costs loaded for ${t.key}`, async () => {
      const r = await page.request.get('/api/fixed-costs')
      const n = ((await r.json()).fixedCosts ?? []).length
      assert(n > 0, `No fixed costs seeded for ${t.key}.`)
      return `${n} fixed costs`
    })

    await j.step(`seeded products appear in Stock (inventory rows exist) for ${t.key}`, async () => {
      const r = await page.request.get('/api/inventory')
      const n = ((await r.json()).items ?? []).length
      assert(n > 0 || count === 0, `${count} products seeded but /api/inventory returns 0 items: the Stock page is empty until each product is bought or adjusted.`)
      return `${n} inventory rows`
    })

    await j.step(`products page renders the catalog for ${t.key}`, async () => {
      await page.goto('/products')
      await expect(page.locator('body')).not.toContainText('NaN')
    })
    j.save({ productCount: count })
  })
}

test('J2 fixed costs, GST config, import wizard', async ({ page }, info) => {
  const j = new Journey('j02-settings-import', page, info)
  await mockInsightOnly(page)
  await mockImportMap(page)
  const u = await createConfirmedUser('import')
  await uiLogin(page, u.email, u.password)
  await page.waitForURL(/\/onboarding/, { timeout: 90_000 })
  await createStore(page.request, { seed: false, name: 'Audit D Import Store' })

  await j.step('settings page loads with fixed-cost empty state', async () => {
    await page.goto('/settings')
    await expect(page.getByText('No fixed costs yet')).toBeVisible()
  })

  await j.step('add a monthly rent fixed cost', async () => {
    await page.getByRole('button', { name: '+ Add cost' }).click()
    await page.getByPlaceholder('e.g. Shop rent').fill('Shop rent')
    await page.getByPlaceholder('e.g. 15000').fill('15000')
    await page.getByRole('button', { name: 'Add cost', exact: true }).click()
    await expect(page.getByText('Shop rent')).toBeVisible()
    await expect(page.getByText('₹500/day')).toBeVisible()
  })

  await j.step('fixed-cost form labels are associated with inputs (a11y)', async () => {
    await page.getByRole('button', { name: '+ Add cost' }).click()
    const byLabel = await page.getByLabel('Cost name *').count()
    await page.getByRole('button', { name: 'Cancel' }).click()
    assert(byLabel > 0, 'Fixed-cost form <Label> elements have no htmlFor, so screen readers announce the inputs without a name.')
  })

  await j.step('GST configuration is available (CGST+SGST / IGST toggle)', async () => {
    const placeholder = page.getByText(/GST slabs and interstate settings - coming soon/)
    if (await placeholder.isVisible()) throw new Error('Settings shows "Tax Configuration ... coming soon". There is no GST slab or IGST/CGST+SGST control anywhere in onboarding or settings.')
  })

  async function importFile(file: string) {
    await page.goto('/settings')
    await page.locator('input[type="file"][accept=".csv,.xlsx,.xls"]').setInputFiles(path.join(IMPORT, file))
    await expect(page.getByText('Column mapping')).toBeVisible({ timeout: 60_000 })
  }

  const before = (await listProducts(page.request)).length
  await j.step('CSV import (20 good rows): preview + mapping shown', async () => {
    await importFile('products-good-20.csv')
    await expect(page.getByText('20 rows · 7 columns')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import 20 rows' })).toBeVisible()
  })
  await j.step('CSV import (20 good rows): all 20 products are imported', async () => {
    await page.getByRole('button', { name: 'Import 20 rows' }).click()
    await expect(page.getByText('Import complete')).toBeVisible({ timeout: 60_000 })
    const shown = await page.getByText(/rows imported/).innerText()
    const after = (await listProducts(page.request)).length
    assert(after - before === 20, `Button said "Import 20 rows"; UI says "${shown}"; catalog grew by ${after - before}. Only the 5-row preview is sent to /api/import/confirm.`)
  })

  const beforeBad = (await listProducts(page.request)).length
  await j.step('CSV with bad rows: imports valid rows, reports skipped ones', async () => {
    await importFile('products-bad-rows.csv')
    await page.getByRole('button', { name: /Import \d+ rows/ }).click()
    const done = page.getByText('Import complete')
    const err = page.locator('p.text-red-600')
    await expect(done.or(err)).toBeVisible({ timeout: 60_000 })
    if (await err.isVisible()) throw new Error(`Import failed outright: "${await err.innerText()}"`)
    const shown = await page.getByText(/rows imported/).innerText()
    const prods = await listProducts(page.request)
    const added = prods.length - beforeBad
    const weird = prods.filter((p) => Number(p.selling_price) < 0 || Number.isNaN(Number(p.selling_price)) || Number(p.selling_price) === 0)
    const rsItem = prods.find((p) => p.name === 'Rs formatted item')
    return `UI: "${shown}". Catalog grew by ${added} (file has 7 data rows: 2 clean, 1 blank name, 1 non-numeric cost, 1 GST 99, 1 "Rs. 1,250" money, 1 negative). Zero/negative/NaN-priced products: ${weird.map((w) => `${w.name}=${w.selling_price}`).join(', ') || 'none'}. "Rs. 1,250"/"₹1,499.00" parsed to purchase=${rsItem?.purchase_price}, selling=${rsItem?.selling_price}.`
  })

  await j.step('bad-row import: negative prices and invalid GST are rejected', async () => {
    const prods = await listProducts(page.request)
    const neg = prods.find((p) => p.name === 'Negative price item')
    const badGst = prods.find((p) => p.name === 'Bad GST Item') as unknown as { tax_rate?: number } | undefined
    const problems: string[] = []
    if (neg) problems.push(`"Negative price item" imported with selling_price=${neg.selling_price}`)
    if (badGst && ![0, 5, 12, 18, 28].includes(Number(badGst.tax_rate))) problems.push(`"Bad GST Item" imported with tax_rate=${badGst.tax_rate}`)
    assert(problems.length === 0, problems.join('; '))
  })

  const beforeHindi = (await listProducts(page.request)).length
  await j.step('XLSX with Hindi product names imports and renders correctly', async () => {
    await importFile('products-hindi.xlsx')
    await expect(page.getByText('आटा 5 किलो')).toBeVisible()
    await page.getByRole('button', { name: /Import \d+ rows/ }).click()
    await expect(page.getByText('Import complete')).toBeVisible({ timeout: 60_000 })
    const prods = await listProducts(page.request)
    const hindi = prods.filter((p) => /[ऀ-ॿ]/.test(p.name))
    assert(prods.length - beforeHindi === 5 && hindi.length >= 5, `Expected 5 Hindi products; catalog grew by ${prods.length - beforeHindi}, Devanagari names found: ${hindi.map((h) => h.name).join(', ')}`)
    const atta = prods.find((p) => p.name === 'आटा 5 किलो')
    assert(atta && Number(atta.selling_price) === 245, `आटा 5 किलो selling price is ${atta?.selling_price}, expected 245 (mapped from "बिक्री मूल्य").`)
  })

  await j.step('Hindi product is searchable in Quick entry', async () => {
    await page.goto('/entry')
    await expect(page.getByText('आटा 5 किलो')).toBeVisible({ timeout: 30_000 })
  })

  await j.step('XLSX (7 good rows) import', async () => {
    const b = (await listProducts(page.request)).length
    await importFile('products-good-7.xlsx')
    await page.getByRole('button', { name: /Import \d+ rows/ }).click()
    await expect(page.getByText('Import complete')).toBeVisible({ timeout: 60_000 })
    const a = (await listProducts(page.request)).length
    assert(a - b === 7, `XLSX with 7 data rows grew the catalog by ${a - b}.`)
  })

  await j.step('re-importing the same good file creates duplicates?', async () => {
    const b = (await listProducts(page.request)).length
    await importFile('products-good-7.xlsx')
    await page.getByRole('button', { name: /Import \d+ rows/ }).click()
    await expect(page.getByText('Import complete').or(page.locator('p.text-red-600'))).toBeVisible({ timeout: 60_000 })
    const a = (await listProducts(page.request)).length
    assert(a === b, `Re-importing the same 7 products added ${a - b} duplicate products (no dedupe by name).`)
  })

  await j.step('settings Sample Templates for a fresh store', async () => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Restaurant', exact: true }).click()
    await expect(page.getByText(/Loaded \d+ products|existing products|fresh store|Failed/i)).toBeVisible({ timeout: 60_000 })
    return await page.getByText(/Loaded \d+ products|existing products|fresh store|Failed/i).first().innerText()
  })

  j.save()
})
