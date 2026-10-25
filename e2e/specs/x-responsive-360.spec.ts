/**
 * 360px sweep: horizontal scroll and tap targets under 44px on every main
 * screen, at the narrowest common Android width (360x740).
 * Runs once (pixel7 project) with a viewport override.
 */
import { test, type Page } from '@playwright/test'
import { Journey } from '../helpers/journey'
import { merchant, listProducts, setStock, createCustomer } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

test.use({ viewport: { width: 360, height: 740 } })

interface Small { tag: string; label: string; w: number; h: number }

async function audit(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const overflowX = doc.scrollWidth - doc.clientWidth
    const wide: string[] = []
    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed') {
        const id = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`
        if (wide.length < 6) wide.push(`${id} right=${Math.round(r.right)}`)
      }
    })
    const small: Small[] = []
    let total = 0
    document.querySelectorAll<HTMLElement>('a[href], button, input:not([type=hidden]), select, textarea, [role=button], label[for]').forEach((el) => {
      const r = el.getBoundingClientRect()
      const st = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || st.display === 'none') return
      if (el.classList.contains('sr-only')) return
      total++
      if (r.width < 44 || r.height < 44) {
        const label = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
        small.push({ tag: el.tagName.toLowerCase(), label, w: Math.round(r.width), h: Math.round(r.height) })
      }
    })
    return { overflowX, wide, total, small }
  })
}

const PUBLIC = ['/', '/login', '/signup', '/privacy', '/terms']
const APP = ['/onboarding', '/dashboard', '/entry', '/entry?mode=full', '/scan', '/voice', '/ledger', '/inventory', '/products', '/customers', '/customers?tab=udhaar', '/transactions', '/reconcile', '/reports', '/advisor', '/settings']

test('360px: public pages', async ({ page }, info) => {
  test.skip(info.project.name !== 'pixel7', 'single run')
  const j = new Journey('x-responsive-360', page, info)
  const rows: Record<string, unknown> = {}
  for (const p of PUBLIC) {
    await page.goto(p)
    await page.waitForLoadState('networkidle').catch(() => {})
    const a = await audit(page)
    rows[p] = a
    await j.shot(`360 ${p}`)
    if (a.overflowX > 0) j.fail(`${p} horizontal scroll`, `scrollWidth exceeds viewport by ${a.overflowX}px: ${a.wide.join('; ')}`)
    j.note(`${p} tap targets`, `${a.small.length}/${a.total} under 44px: ${a.small.slice(0, 8).map((s) => `${s.tag}"${s.label}" ${s.w}x${s.h}`).join(', ')}`)
  }
  j.save({ pages: rows, scope: 'public' })
})

test('360px: app pages', async ({ page }, info) => {
  test.skip(info.project.name !== 'pixel7', 'single run')
  const j = new Journey('x-responsive-360-app', page, info)
  await mockInsightOnly(page)
  await merchant(page, 'r360')
  const [p1] = await listProducts(page.request)
  await setStock(page.request, p1.id, 10)
  const c = await createCustomer(page.request, 'Responsive Cust', '9000033333')
  await page.request.post('/api/entry/quick', { data: { type: 'sale', paymentMethod: 'credit', customerId: c.id, items: [{ productId: p1.id, quantity: 1 }] } })
  const rows: Record<string, unknown> = {}
  for (const p of APP) {
    await page.goto(p)
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    const a = await audit(page)
    rows[p] = a
    await j.shot(`360 ${p}`)
    if (a.overflowX > 0) j.fail(`${p} horizontal scroll`, `scrollWidth exceeds viewport by ${a.overflowX}px: ${a.wide.join('; ')}`)
    j.note(`${p} tap targets`, `${a.small.length}/${a.total} under 44px: ${a.small.slice(0, 10).map((s) => `${s.tag}"${s.label}" ${s.w}x${s.h}`).join(', ')}`)
  }
  j.save({ pages: rows, scope: 'app' })
})
