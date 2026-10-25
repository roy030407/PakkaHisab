/**
 * FILE: eval/lib/env.ts
 *
 * WHAT THIS DOES:
 *   Loads .env.local into process.env for eval runs (tsx does not do this the
 *   way Next.js does). Strips a UTF-8 BOM, never overwrites a variable that is
 *   already set, and never prints values.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   First import in eval/run.ts and eval/fixtures/voice/generate.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/run.ts, eval/fixtures/voice/generate.ts
 */
import fs from 'node:fs'
import path from 'node:path'

export const REPO_ROOT = path.resolve(__dirname, '..', '..')

export function loadEnvLocal(file = path.join(REPO_ROOT, '.env.local')): void {
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    const value = m[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}
