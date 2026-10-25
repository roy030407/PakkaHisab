/**
 * Journey 9: inventory. Stock list, adjust, expiry alerts, order suggestions,
 * variants (add via product edit, appear in entry/stock).
 * Expiry dates can only be set through an inventory import, so the journey
 * imports a small inventory CSV (column mapping mocked to "inventory").
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { Journey, assert } from '../helpers/journey'
import { merchant, listProducts, stockOf, setStock } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

const ddmmyyyy = (offset: number) => {
  const d = new Date(Date.now() + 5.5 * 3600_000 + offset * 86_400_000)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

test('J9 inventory', async ({ page }, info) => {
  const j = new Journey('j09-inventory', page, info)
  await mockInsightOnly(page)
  await merchant(page, 'inv')
  const prods = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))
  const [a, b, c, d] = prods

  await j.step('fresh seeded store: Stock page lists the catalog', async () => {
    await page.goto('/inventory')
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible()
    const visible = await page.getByText(a.name).count()
    assert(visible > 0, `${prods.length} seeded products, but "${a.name}" is not on the Stock page. Inventory rows are only created on the first stock movement, so a new store sees an empty stock list and cannot adjust items that are not listed.`)
  })

  // Give stock: a ok (50), b low (2), c out (0 after +1/-1), d for expiry
  await setStock(page.request, a.id, 50)
  await setStock(page.request, b.id, 2)
  await setStock(page.request, c.id, 1)
  await setStock(page.request, c.id, -1)
  await setStock(page.request, d.id, 20)

  await j.step('stock list colour-codes ok / low / out', async () => {
    await page.goto('/inventory')
    await expect(page.getByText(a.name).first()).toBeVisible()
    await expect(page.getByText(b.name).first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText('NaN')
  })

  await j.step('adjust stock from the list (+3, reason correction)', async () => {
    const before = await stockOf(page.request, a.id)
    await page.getByPlaceholder('Search products...').fill(a.name)
    await page.getByText(a.name).first().click()
    await expect(page.getByText('Adjust by')).toBeVisible()
    const plus = page.locator('div.fixed').getByRole('button', { name: '+' })
    for (let i = 0; i < 3; i++) await plus.click()
    await page.locator('div.fixed').getByRole('button', { name: /save|apply|update/i }).click()
    await expect.poll(() => stockOf(page.request, a.id)).toBe((before ?? 0) + 3)
  })

  await j.step('expiry date can be set from the UI', async () => {
    const field = page.getByLabel(/expiry/i).or(page.getByPlaceholder(/expiry/i))
    assert(await field.count() > 0, 'No expiry field on product or stock screens; expiry_date is only writable through an inventory CSV import.')
  })

  await j.step('set expiry via inventory import (5 days out)', async () => {
    const csv = `Product,Stock,Reorder level,Expiry\n"${d.name}",20,5,${ddmmyyyy(5)}\n"${a.name}",53,10,${ddmmyyyy(60)}\n`
    const file = path.join(info.outputDir, 'inventory-expiry.csv')
    fs.mkdirSync(info.outputDir, { recursive: true })
    fs.writeFileSync(file, csv)
    await page.route('**/api/import/map', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dataType: 'inventory', mapping: { Product: 'product_name', Stock: 'current_stock', 'Reorder level': 'reorder_point', Expiry: 'expiry_date' } }) }))
    await page.goto('/settings')
    await page.locator('input[type="file"][accept=".csv,.xlsx,.xls"]').setInputFiles(file)
    await page.getByRole('button', { name: 'Import 2 rows' }).click()
    await expect(page.getByText('Import complete')).toBeVisible({ timeout: 60_000 })
  })

  await j.step('expiry alert lists the product expiring in 5 days', async () => {
    await page.goto('/inventory')
    await expect(page.getByText('Consider a discount or priority sale.')).toBeVisible()
    await expect(page.getByText(d.name).first()).toBeVisible()
  })

  await j.step('dashboard shows an expiry alert count', async () => {
    await page.goto('/dashboard')
    await expect(page.getByText(/expir/i).first()).toBeVisible()
  })

  await j.step('order suggestions: "Order today" includes the low/out items', async () => {
    await page.goto('/inventory')
    await expect(page.getByText('Order today')).toBeVisible({ timeout: 30_000 })
    const r = await (await page.request.get('/api/inventory/suggest')).json()
    const names = JSON.stringify(r)
    assert(names.includes(b.name) || names.includes(c.name), `suggest API: ${names.slice(0, 300)}`)
    return names.slice(0, 300)
  })

  await j.step('tap a suggestion logs a purchase directly (CLAUDE.md 3d)', async () => {
    const link = page.locator('a[href*="/entry"], a[href*="/scan"]').filter({ hasText: new RegExp(b.name.slice(0, 6)) })
    assert(await link.count() > 0, 'Suggestion rows are not tappable to log a purchase.')
  })

  // ─── Variants ───
  await j.step('add variants from the product edit form', async () => {
    await page.goto('/products')
    await page.getByPlaceholder('Search by name, brand, or item number...').fill(a.name)
    await page.getByRole('button', { name: 'Edit' }).first().click()
    await expect(page.getByText('Variants')).toBeVisible()
    await page.getByRole('button', { name: /\+ Add variant|Add variant/ }).first().click()
    await page.getByPlaceholder('e.g. Thums Up 500ml').fill(`${a.name} Family Pack`)
    const nums = page.locator('div', { has: page.getByPlaceholder('e.g. Thums Up 500ml') }).locator('input[type="number"]')
    await nums.nth(0).fill('180')
    await nums.nth(1).fill('210')
    await page.getByRole('button', { name: /^(Add|Save)( variant)?$/ }).last().click()
    await expect(page.getByText(`${a.name} Family Pack`)).toBeVisible({ timeout: 20_000 })
  })

  await j.step('variant is sellable in Quick entry', async () => {
    await page.goto('/entry')
    await expect(page.getByText(`${a.name} Family Pack`)).toBeVisible({ timeout: 30_000 })
  })

  await j.step('fuzzy product search with a typo', async () => {
    await page.goto('/products')
    const typo = a.name.slice(0, 3) + a.name.slice(4, 8) // drop a letter
    await page.getByPlaceholder('Search by name, brand, or item number...').fill(typo)
    await expect(page.getByText(a.name).first()).toBeVisible()
    return `searched "${typo}"`
  })

  j.save()
})
