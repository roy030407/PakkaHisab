/**
 * Journey 13: privacy and terms pages, 404, error boundary, and how each
 * screen behaves when its API returns 500 (forced with a route mock).
 */
import { test, expect } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import { merchant } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

test('J13 public pages + 404', async ({ page }, info) => {
  const j = new Journey('j13-public', page, info)
  for (const [path, heading] of [['/privacy', /privacy|data/i], ['/terms', /terms/i]] as const) {
    await j.step(`${path} renders`, async () => {
      const r = await page.goto(path)
      assert(r?.status() === 200, `status ${r?.status()}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
      const text = await page.locator('body').innerText()
      assert(!text.includes('—'), `${path} contains an em dash (project rule)`)
      return `${text.length} chars`
    })
  }
  await j.step('privacy/terms linked from signup', async () => {
    await page.goto('/signup')
    await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  })
  await j.step('unknown page shows a helpful 404 with a way home', async () => {
    const r = await page.goto('/this-page-does-not-exist-audit-d')
    assert(r?.status() === 404, `status ${r?.status()}`)
    const home = page.getByRole('link', { name: /home|dashboard|back/i })
    assert(await home.count() > 0, '404 page has no link back to the app')
  })
  await j.step('unknown API route returns JSON 404', async () => {
    const r = await page.request.get('/api/does-not-exist')
    return `status ${r.status()} content-type ${r.headers()['content-type']}`
  })
  await j.step('logged-out access to a dashboard route redirects to /login', async () => {
    await page.context().clearCookies()
    await page.goto('/reports')
    await expect(page).toHaveURL(/\/login/)
  })
  await j.step('logged-out API call returns 401 JSON', async () => {
    const r = await page.request.get('/api/customers')
    assert(r.status() === 401, `status ${r.status()}`)
  })
  await j.step('/api/health reflects database reachability', async () => {
    const r = await page.request.get('/api/health')
    return `${r.status()} ${await r.text()}`
  })
  j.save()
})

test('J13 error boundary + API 500 handling', async ({ page }, info) => {
  const j = new Journey('j13-errors', page, info)
  await mockInsightOnly(page)
  await merchant(page, 'err')

  await j.step('client render crash is caught by AppErrorBoundary', async () => {
    // A malformed report payload makes ReportsPage read report.taxSummary.payable of undefined.
    await page.route('**/api/reports?period=*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodLabel: 'x', transactionCount: 1, sales: 1 }) }))
    await page.goto('/reports')
    await expect(page.getByText(/something went wrong|try again|reload/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('navigation').first()).toBeVisible()
    await page.unroute('**/api/reports?period=*')
  })

  // Each screen with its main API forced to 500 (JSON body, like the real routes).
  const cases: Array<{ path: string; api: string; ready?: RegExp }> = [
    { path: '/dashboard', api: '**/api/dashboard*' },
    { path: '/customers', api: '**/api/customers' },
    { path: '/inventory', api: '**/api/inventory' },
    { path: '/transactions', api: '**/api/transactions?*' },
    { path: '/reconcile', api: '**/api/reconciliation*' },
    { path: '/reports', api: '**/api/reports?*' },
    { path: '/products', api: '**/api/products*' },
    { path: '/entry', api: '**/api/products' },
    { path: '/settings', api: '**/api/fixed-costs' },
  ]
  for (const c of cases) {
    await j.step(`${c.path} with ${c.api.replace('**', '')} -> 500 shows an error state`, async () => {
      await page.route(c.api, (r) => r.request().method() === 'GET'
        ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Failed to load' }) })
        : r.continue())
      await page.goto(c.path)
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
      const body = await page.locator('body').innerText()
      await page.unroute(c.api)
      const errorShown = /could not|couldn.t|something went wrong|try again|failed/i.test(body)
      const misleadingEmpty = /no customers yet|no products yet|no transactions|no fixed costs yet|No products yet/i.test(body)
      const crashed = /Application error|Unhandled Runtime Error/i.test(body)
      assert(!crashed, 'page crashed')
      assert(errorShown && !misleadingEmpty, errorShown
        ? 'error shown, but next to a misleading empty state'
        : misleadingEmpty
          ? 'API failed but the page shows the normal empty state ("no ... yet"); the merchant thinks their data is gone'
          : 'API failed and the page shows no error at all (blank or stale)')
    })
  }

  await j.step('save failure on quick entry shows a toast and keeps the cart', async () => {
    await page.goto('/entry')
    const plus = page.getByRole('button', { name: /^Increase / }).first()
    await plus.click()
    await page.route('**/api/entry/quick', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"db"}' }))
    await page.getByRole('button', { name: /Save sale/ }).click()
    await expect(page.getByText('Could not save. Please try again.')).toBeVisible()
    await expect(page.getByText('1 item added')).toBeVisible()
    await page.unroute('**/api/entry/quick')
  })

  await j.step('offline save on quick entry', async () => {
    await page.context().setOffline(true)
    await page.getByRole('button', { name: /Save sale/ }).click()
    await expect(page.getByText(/check your connection/i)).toBeVisible()
    await page.context().setOffline(false)
  })

  j.save()
})
