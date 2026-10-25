/**
 * Lighthouse mobile (default simulated throttling: 150ms RTT, 1.6 Mbps down,
 * 4x CPU slowdown, i.e. Lighthouse's "Slow 4G" mobile profile) on
 * dashboard, scan, voice and reports, logged in as a fresh audit-d user.
 *
 * Playwright's Chromium is launched as a persistent context with a remote
 * debugging port; Lighthouse attaches to the same browser, so the login
 * cookies apply. /api/ai/* is blocked so no real Gemini call is made.
 *
 * NOTE: runs against the dev server (unminified, on-demand compilation), so
 * absolute performance numbers are pessimistic versus a production build.
 * Each page is warmed once before measuring to remove compile time.
 *
 * Run: npx tsx scripts/lighthouse.ts
 * Output: results/lighthouse.json (+ results/lighthouse-<page>.html)
 */
import { chromium } from '@playwright/test'
// lighthouse is ESM-only; force a native import so tsx does not route it through require().
const nativeImport = new Function('s', 'return import(s)') as (s: string) => Promise<{ default: typeof import('lighthouse').default }>
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createConfirmedUser, createStore } from '../helpers/session'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const PORT = 9333
const PAGES = ['/dashboard', '/scan', '/voice', '/reports', ...(process.env.LH_EXTRA ? process.env.LH_EXTRA.split(',') : [])]
const OUT = path.resolve(__dirname, '..', 'results')

async function main() {
  const lighthouse = (await nativeImport('lighthouse')).default
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-audit-d-'))
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [`--remote-debugging-port=${PORT}`],
    viewport: { width: 412, height: 915 },
  })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  page.setDefaultNavigationTimeout(120_000)

  const authed = process.env.LH_PUBLIC_ONLY !== '1'
  if (authed) {
    const u = await createConfirmedUser('lighthouse')
    await page.goto(`${BASE}/login`)
    await page.getByLabel('Email').fill(u.email)
    await page.getByLabel('Password').fill(u.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 120_000 })
    await createStore(page.request, { seed: true, name: 'Audit D Lighthouse' })
  }
  const pages = authed ? PAGES : ['/', '/login', '/signup']

  const results: Record<string, unknown> = {}
  for (const p of pages) {
    // Warm the route so dev-server compile time is not measured.
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' }).catch(() => {})
    const runner = await lighthouse(`${BASE}${p}`, {
      port: PORT,
      output: ['json', 'html'],
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices'],
      formFactor: 'mobile',
      disableStorageReset: true,
      blockedUrlPatterns: ['*/api/ai/*', '*posthog*', '*umami*'],
    })
    if (!runner) continue
    const lhr = runner.lhr
    const a = lhr.audits
    const ms = (k: string) => Math.round(Number(a[k]?.numericValue ?? NaN))
    const r = {
      finalUrl: lhr.finalDisplayedUrl,
      performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score ?? 0) * 100),
      FCP: ms('first-contentful-paint'),
      LCP: ms('largest-contentful-paint'),
      TBT: ms('total-blocking-time'),
      CLS: Number(a['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3),
      SI: ms('speed-index'),
      TTI: ms('interactive'),
      totalBytes: Math.round(Number(a['total-byte-weight']?.numericValue ?? 0) / 1024) + ' KiB',
      a11yFailures: Object.values(a)
        .filter((x) => lhr.categories.accessibility.auditRefs.some((ref) => ref.id === x.id) && x.score === 0)
        .map((x) => `${x.id}: ${x.title}`),
      over3s: [] as string[],
    }
    for (const k of ['FCP', 'LCP', 'SI', 'TTI'] as const) if ((r[k] as number) > 3000) r.over3s.push(`${k} ${(r[k] as number) / 1000}s`)
    results[p] = r
    const html = Array.isArray(runner.report) ? runner.report[1] : ''
    fs.writeFileSync(path.join(OUT, `lighthouse-${p.replace(/\W+/g, '') || 'home'}.html`), html)
    console.log(p, JSON.stringify({ perf: r.performance, a11y: r.accessibility, LCP: r.LCP, TTI: r.TTI, over3s: r.over3s }))
  }
  fs.writeFileSync(path.join(OUT, authed ? 'lighthouse.json' : 'lighthouse-public.json'), JSON.stringify(results, null, 2))
  await ctx.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
