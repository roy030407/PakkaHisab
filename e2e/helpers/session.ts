/**
 * Test user + store setup for the Session D audit.
 *
 * Users are created with the Supabase admin API (email pre-confirmed, so no
 * real emails are sent). Only the signup journey goes through the public
 * signUp flow. Every email starts with "audit-d-" so these rows are easy to
 * find and delete later (see e2e/scripts/cleanup-audit-d.ts).
 */
import { createClient } from '@supabase/supabase-js'
import type { Page, APIRequestContext } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'
import { expect } from '@playwright/test'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local'), quiet: true })

export const PASSWORD = 'AuditD-pass-123'
export const EMAIL_DOMAIN = 'pakkahisab-audit.dev'

export function auditEmail(tag: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `audit-d-${tag}-${Date.now().toString(36)}-${rand}@${EMAIL_DOMAIN}`.toLowerCase()
}

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing in ../.env.local')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function createConfirmedUser(tag: string): Promise<{ email: string; password: string; id: string }> {
  const email = auditEmail(tag)
  const { data, error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  return { email, password: PASSWORD, id: data.user.id }
}

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

export interface StoreOpts {
  type?: string
  name?: string
  seed?: boolean
  language?: string
}

/** Create the store through the same API the onboarding form uses. */
export async function createStore(req: APIRequestContext, opts: StoreOpts = {}) {
  const res = await req.post('/api/stores', {
    data: {
      name: opts.name ?? 'Audit D Kirana',
      type: opts.type ?? 'kirana',
      ownerName: 'Audit Owner',
      city: 'Hyderabad',
      gstNumber: '',
      preferredLanguage: opts.language ?? 'en',
      wantsSampleStore: !!opts.seed,
    },
  })
  if (!res.ok()) throw new Error(`POST /api/stores ${res.status()} ${await res.text()}`)
  if (opts.seed) {
    const s = await req.post('/api/stores/seed')
    if (!s.ok()) throw new Error(`POST /api/stores/seed ${s.status()} ${await s.text()}`)
    return { store: (await res.json()).store, seed: await s.json() }
  }
  return { store: (await res.json()).store, seed: null }
}

/**
 * Full fixture: confirmed user, logged in through the UI, store created
 * (seeded kirana by default). Leaves the page on /dashboard.
 */
export async function merchant(page: Page, tag: string, opts: StoreOpts = { seed: true }) {
  const user = await createConfirmedUser(tag)
  await uiLogin(page, user.email, user.password)
  // New user has no store yet: the dashboard layout redirects to onboarding.
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 90_000 })
  const created = await createStore(page.request, { seed: true, ...opts })
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)
  return { user, ...created }
}

export interface ApiProduct { id: string; name: string; selling_price: number; purchase_price: number; unit: string; parent_product_id: string | null }

export async function listProducts(req: APIRequestContext): Promise<ApiProduct[]> {
  const r = await req.get('/api/products')
  return (await r.json()).products ?? []
}

export async function addProduct(req: APIRequestContext, p: { name: string; sellingPrice: number; purchasePrice?: number; parentProductId?: string; unit?: string; category?: string }) {
  const r = await req.post('/api/products', {
    data: { unit: 'piece', category: 'Grocery', purchasePrice: p.purchasePrice ?? Math.round(p.sellingPrice * 0.8), ...p },
  })
  if (!r.ok()) throw new Error(`POST /api/products ${r.status()} ${await r.text()}`)
  return (await r.json()).product as ApiProduct
}

export async function stockOf(req: APIRequestContext, productId: string): Promise<number | null> {
  const r = await req.get('/api/inventory')
  const items = (await r.json()).items ?? []
  const it = items.find((i: { productId: string }) => i.productId === productId)
  return it ? Number(it.currentStock) : null
}

export async function setStock(req: APIRequestContext, productId: string, delta: number) {
  const r = await req.patch('/api/inventory', { data: { productId, delta, reason: 'correction' } })
  if (!r.ok()) throw new Error(`PATCH /api/inventory ${r.status()} ${await r.text()}`)
}

export async function createCustomer(req: APIRequestContext, name: string, phone?: string) {
  const r = await req.post('/api/customers', { data: { name, phone, type: 'regular' } })
  if (!r.ok()) throw new Error(`POST /api/customers ${r.status()} ${await r.text()}`)
  return (await r.json()).customer as { id: string; name: string }
}

export async function customerBalance(req: APIRequestContext, id: string): Promise<number> {
  const r = await req.get(`/api/customers/${id}`)
  return Number((await r.json()).customer?.current_balance)
}

/**
 * Replace window.open and navigator.clipboard.writeText so WhatsApp links and
 * share URLs are captured instead of opened. Read them back with captured().
 */
export async function captureOutbound(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: string[]; __copied: string[] }
    w.__opened = []
    w.__copied = []
    window.open = ((url?: string | URL) => { w.__opened.push(String(url)); return null }) as typeof window.open
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (t: string) => { w.__copied.push(t) }, readText: async () => w.__copied.at(-1) ?? '' },
      })
    } catch { /* ignore */ }
  })
}

export async function captured(page: Page): Promise<{ opened: string[]; copied: string[] }> {
  return page.evaluate(() => {
    const w = window as unknown as { __opened?: string[]; __copied?: string[] }
    return { opened: w.__opened ?? [], copied: w.__copied ?? [] }
  })
}

/** Today's date in IST as YYYY-MM-DD (what a merchant in India sees). */
export function todayIST(offsetDays = 0): string {
  const d = new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000)
  return d.toISOString().slice(0, 10)
}
