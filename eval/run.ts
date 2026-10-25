/**
 * FILE: eval/run.ts
 *
 * WHAT THIS DOES:
 *   CLI for the bill-scan and voice evals. Runs the production extraction /
 *   voice-parse functions over the fixtures and writes eval/results/*.json|md.
 *
 *   npx tsx eval/run.ts --task scan|voice --model <gemini model> [options]
 *     --provider <name>      backend from eval/lib/providers (default gemini)
 *     --delay <ms>           pause before each LIVE call (default 4500, ~13 RPM)
 *     --retries <n>          retries on 429/5xx with backoff (default 4; 0 = prod behaviour)
 *     --no-cache             ignore and do not write the response cache
 *     --only <id,id>         run only these fixture ids
 *     --robustness           also run the robustness fixtures (X-*)
 *     --corrections <file>   scan only: JSON array of extraction_corrections rows
 *                            used as the store's few-shot corrections (default none)
 *     --inject-error <code>  make every model call fail with this HTTP status
 *     --label <text>         suffix for the results file name
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Entry point of the eval/ harness. See eval/README.md.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually ; eval/lib/*
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvLocal } from './lib/env'
import { SCAN_PROVIDERS, VOICE_PROVIDERS } from './lib/providers'
import type { ProviderOptions } from './lib/providers/types'
import { runScan, summarizeScan, worstScan } from './lib/tasks/scan'
import { runVoice, summarizeVoice, worstVoice } from './lib/tasks/voice'
import { writeReport } from './lib/report'
import type { Row } from './lib/fakeSupabase'

function parseArgs(argv: string[]) {
  const get = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
  const has = (k: string) => argv.includes(`--${k}`)
  return {
    task: get('task'),
    model: get('model'),
    provider: get('provider') ?? 'gemini',
    delayMs: Number(get('delay') ?? 4500),
    retries: Number(get('retries') ?? 4),
    useCache: !has('no-cache'),
    only: get('only')?.split(',').map(s => s.trim()).filter(Boolean),
    robustness: has('robustness'),
    corrections: get('corrections'),
    injectError: get('inject-error') ? Number(get('inject-error')) : undefined,
    label: get('label'),
  }
}

async function main() {
  loadEnvLocal()
  const a = parseArgs(process.argv.slice(2))
  if ((a.task !== 'scan' && a.task !== 'voice') || !a.model) {
    console.error('usage: npx tsx eval/run.ts --task scan|voice --model <name> [--provider gemini] [--delay ms] [--retries n] [--no-cache] [--only ids] [--robustness] [--corrections file] [--inject-error code] [--label text]')
    process.exit(2)
  }
  const log = (m: string) => console.log(m)
  const popts: ProviderOptions = {
    model: a.model,
    cacheDir: path.join(__dirname, 'cache', a.task),
    delayMs: a.delayMs,
    maxRetries: a.retries,
    useCache: a.useCache,
    injectError: a.injectError,
    log,
  }
  const options = { delayMs: a.delayMs, retries: a.retries, cache: a.useCache, only: a.only, robustness: a.robustness, corrections: a.corrections ?? null, injectError: a.injectError ?? null }

  if (a.task === 'scan') {
    const factory = SCAN_PROVIDERS[a.provider]
    if (!factory) throw new Error(`unknown scan provider ${a.provider}`)
    const corrections: Row[] = a.corrections
      ? (JSON.parse(fs.readFileSync(a.corrections, 'utf8')) as Row[]).map((c, i) => ({ store_id: 'store-eval', created_at: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`, ...c }))
      : []
    const provider = await factory(popts)
    const results = await runScan(provider, { only: a.only, includeRobustness: a.robustness, corrections, log })
    const summary = summarizeScan(results)
    const out = writeReport({ task: 'scan', model: a.model, provider: a.provider, label: a.label, options, summary, worst: worstScan(results), results })
    console.log(JSON.stringify({ ...summary, byTag: undefined, causeCounts: summary.causeCounts }, null, 1))
    console.log(`\nwrote ${path.relative(process.cwd(), out.json)}\nwrote ${path.relative(process.cwd(), out.md)}`)
  } else {
    const factory = VOICE_PROVIDERS[a.provider]
    if (!factory) throw new Error(`unknown voice provider ${a.provider}`)
    const provider = await factory(popts)
    const results = await runVoice(provider, { only: a.only, includeRobustness: a.robustness, log })
    const summary = summarizeVoice(results)
    const out = writeReport({ task: 'voice', model: a.model, provider: a.provider, label: a.label, options, summary, worst: worstVoice(results), results })
    console.log(JSON.stringify({ ...summary, byTag: undefined }, null, 1))
    console.log(`\nwrote ${path.relative(process.cwd(), out.json)}\nwrote ${path.relative(process.cwd(), out.md)}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
