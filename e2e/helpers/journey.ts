/**
 * Journey recorder for the Session D audit.
 *
 * A journey is a sequence of steps. Each step is run inside try/catch so one
 * broken step does not hide the rest of the journey; the outcome of every
 * step (pass / fail / info) is written to e2e/results/<journey>__<project>.json
 * and later rolled up into audit/findings-D.md.
 *
 * Screenshots go to audit/screens/<journey>/<project>-<nn>-<name>.png.
 * Console errors, uncaught page errors and API 5xx responses are captured too.
 */
import type { Page, TestInfo } from '@playwright/test'
import fs from 'fs'
import path from 'path'

export type StepStatus = 'pass' | 'fail' | 'info'
export interface StepResult { name: string; status: StepStatus; detail?: string; screenshot?: string }

const ROOT = path.resolve(__dirname, '..', '..')
export const SCREENS_DIR = path.join(ROOT, 'audit', 'screens')
export const RESULTS_DIR = path.resolve(__dirname, '..', 'results')

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export class Journey {
  readonly steps: StepResult[] = []
  readonly consoleErrors: string[] = []
  readonly pageErrors: string[] = []
  readonly serverErrors: string[] = []
  private n = 0

  constructor(readonly id: string, readonly page: Page, readonly info: TestInfo) {
    this.attach(page)
  }

  get project() { return this.info.project.name }

  /** Listen for console errors, uncaught exceptions and API 5xx on a page. */
  attach(page: Page) {
    page.on('console', (m) => {
      if (m.type() === 'error') this.consoleErrors.push(m.text().slice(0, 300))
    })
    page.on('pageerror', (e) => this.pageErrors.push(String(e.message).slice(0, 300)))
    page.on('response', (r) => {
      const u = r.url()
      if (r.status() >= 500 && u.includes('/api/')) this.serverErrors.push(`${r.status()} ${r.request().method()} ${new URL(u).pathname}`)
    })
  }

  async shot(name: string, page: Page = this.page): Promise<string> {
    this.n += 1
    const dir = path.join(SCREENS_DIR, this.id)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${this.project}-${String(this.n).padStart(2, '0')}-${slug(name)}.png`)
    try {
      await page.screenshot({ path: file, fullPage: true, timeout: 15_000 })
    } catch {
      try { await page.screenshot({ path: file, timeout: 10_000 }) } catch { return '' }
    }
    return path.relative(ROOT, file).replace(/\\/g, '/')
  }

  /** Run a step; never throws. Returns true when the step passed. */
  async step(name: string, fn: () => Promise<unknown>, opts: { shot?: boolean } = {}): Promise<boolean> {
    try {
      const detail = await fn()
      const screenshot = opts.shot === false ? undefined : await this.shot(name)
      this.steps.push({ name, status: 'pass', detail: typeof detail === 'string' ? detail : undefined, screenshot })
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const screenshot = await this.shot(`FAIL ${name}`)
      this.steps.push({ name, status: 'fail', detail: msg.split('\n').filter(Boolean).slice(0, 4).join(' | ').slice(0, 600), screenshot })
      return false
    }
  }

  /** Record an observation that is not pass/fail (a measured value, a quirk). */
  note(name: string, detail: string) {
    this.steps.push({ name, status: 'info', detail })
  }

  /** Record a hard fact as a failed check without throwing. */
  fail(name: string, detail: string) {
    this.steps.push({ name, status: 'fail', detail })
  }

  save(extra: Record<string, unknown> = {}) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
    const out = {
      journey: this.id,
      project: this.project,
      finishedAt: new Date().toISOString(),
      steps: this.steps,
      consoleErrors: [...new Set(this.consoleErrors)].slice(0, 30),
      pageErrors: [...new Set(this.pageErrors)].slice(0, 30),
      serverErrors: [...new Set(this.serverErrors)].slice(0, 30),
      ...extra,
    }
    fs.writeFileSync(path.join(RESULTS_DIR, `${this.id}__${this.project}.json`), JSON.stringify(out, null, 2))
  }
}

/** Throw with a readable message when a condition is false. */
export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
