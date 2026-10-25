/**
 * FILE: eval/lib/gateway.ts
 *
 * WHAT THIS DOES:
 *   Wraps the app's own Gemini client (lib/anthropic/client.ts singleton) so
 *   every generateContent call made by the PRODUCTION extraction / voice code
 *   goes through: an on-disk response cache (reruns are free), a configurable
 *   delay between live calls (free-tier RPM), retries with exponential backoff
 *   on 429/500/503 (honouring the API's retryDelay hint), optional fault
 *   injection, and per-call telemetry (latency, tokens, finishReason, attempts).
 *
 *   The app code is not modified: we patch the method on the singleton
 *   instance that the app modules themselves obtain via getGeminiClient().
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Installed once by eval/lib/providers/gemini.ts before any app call.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/lib/providers/gemini.ts, eval/fixtures/voice/generate.ts ;
 *   uses @google/genai
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { GenerateContentResponse, type GoogleGenAI, type GenerateContentParameters } from '@google/genai'

export interface CallTelemetry {
  cacheHit: boolean
  latencyMs: number          // latency of the successful (or last) attempt, as originally measured
  attempts: number           // 1 = first try succeeded; app code has NO retry, so >1 means prod would have failed
  waitedMs: number           // total backoff wait (live calls only)
  promptTokens?: number
  outputTokens?: number
  thoughtsTokens?: number
  totalTokens?: number
  finishReason?: string
  responseText?: string     // raw model text, so silent JSON-parse fallbacks in app code are visible
  model: string
  error?: { status?: number; message: string }
}

export interface GatewayOptions {
  cacheDir: string
  delayMs: number            // pause before every live (non-cached) call
  maxRetries: number         // retries on 429/5xx; 0 reproduces production behaviour exactly
  useCache: boolean
  injectError?: number       // e.g. 429 or 404: throw a synthetic ApiError-like error instead of calling
  log?: (msg: string) => void
}

type GenerateFn = (p: GenerateContentParameters) => Promise<GenerateContentResponse>

interface CachedEntry {
  key: string
  model: string
  createdAt: string
  latencyMs: number
  response: Record<string, unknown>
}

let lastTelemetry: CallTelemetry | null = null
const allTelemetry: CallTelemetry[] = []

export function takeTelemetry(): CallTelemetry[] {
  const out = allTelemetry.splice(0, allTelemetry.length)
  lastTelemetry = null
  return out
}

export function peekLastTelemetry(): CallTelemetry | null {
  return lastTelemetry
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; message?: unknown }
  if (typeof e?.status === 'number') return e.status
  const m = typeof e?.message === 'string' ? e.message.match(/"code"\s*:\s*(\d{3})|\b(429|500|503|404|400|403)\b/) : null
  return m ? Number(m[1] ?? m[2]) : undefined
}

// The API puts a hint like "retryDelay":"37s" in 429 bodies; respect it.
function retryHintMs(err: unknown): number | undefined {
  const msg = (err as { message?: unknown })?.message
  if (typeof msg !== 'string') return undefined
  const m = msg.match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/)
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined
}

function cacheKey(p: GenerateContentParameters): string {
  return crypto.createHash('sha256').update(JSON.stringify({ model: p.model, contents: p.contents, config: p.config })).digest('hex')
}

function telemetryFrom(resp: GenerateContentResponse, model: string, latencyMs: number, cacheHit: boolean, attempts: number, waitedMs: number): CallTelemetry {
  const u = resp.usageMetadata
  return {
    cacheHit,
    latencyMs,
    attempts,
    waitedMs,
    promptTokens: u?.promptTokenCount,
    outputTokens: u?.candidatesTokenCount,
    thoughtsTokens: u?.thoughtsTokenCount,
    totalTokens: u?.totalTokenCount,
    finishReason: resp.candidates?.[0]?.finishReason,
    responseText: (resp.text ?? '').slice(0, 8000),
    model,
  }
}

export function installGateway(client: GoogleGenAI, opts: GatewayOptions): void {
  const models = client.models as unknown as { generateContent: GenerateFn; __evalPatched?: boolean }
  if (models.__evalPatched) return
  const original: GenerateFn = models.generateContent.bind(client.models)
  fs.mkdirSync(opts.cacheDir, { recursive: true })
  let lastLiveCall = 0

  const wrapped: GenerateFn = async (p) => {
    const model = String(p.model)
    if (opts.injectError) {
      const status = opts.injectError
      const err = Object.assign(new Error(`{"error":{"code":${status},"message":"eval-injected ${status}","status":"INJECTED"}}`), { status })
      const t: CallTelemetry = { cacheHit: false, latencyMs: 0, attempts: 1, waitedMs: 0, model, error: { status, message: 'injected' } }
      lastTelemetry = t; allTelemetry.push(t)
      throw err
    }

    const key = cacheKey(p)
    const file = path.join(opts.cacheDir, `${key}.json`)
    if (opts.useCache && fs.existsSync(file)) {
      const entry = JSON.parse(fs.readFileSync(file, 'utf8')) as CachedEntry
      const resp = Object.assign(new GenerateContentResponse(), entry.response)
      const t = telemetryFrom(resp, model, entry.latencyMs, true, 1, 0)
      lastTelemetry = t; allTelemetry.push(t)
      return resp
    }

    let attempts = 0
    let waitedMs = 0
    for (;;) {
      const since = Date.now() - lastLiveCall
      if (since < opts.delayMs) await sleep(opts.delayMs - since)
      attempts++
      const t0 = Date.now()
      lastLiveCall = t0
      try {
        const resp = await original(p)
        const latencyMs = Date.now() - t0
        const entry: CachedEntry = {
          key, model, createdAt: new Date().toISOString(), latencyMs,
          response: JSON.parse(JSON.stringify(resp)) as Record<string, unknown>,
        }
        if (opts.useCache) fs.writeFileSync(file, JSON.stringify(entry))
        const t = telemetryFrom(resp, model, latencyMs, false, attempts, waitedMs)
        lastTelemetry = t; allTelemetry.push(t)
        return resp
      } catch (err) {
        const latencyMs = Date.now() - t0
        const status = statusOf(err)
        const hint = retryHintMs(err)
        // A retryDelay of minutes or hours means the DAILY free-tier quota is gone: fail fast.
        const dailyQuota = status === 429 && hint !== undefined && hint > 120_000
        const retryable = (status === 429 && !dailyQuota) || status === 500 || status === 503
        if (!retryable || attempts > opts.maxRetries) {
          const msg = err instanceof Error ? err.message : String(err)
          const t: CallTelemetry = { cacheHit: false, latencyMs, attempts, waitedMs, model, error: { status, message: msg.slice(0, 300) } }
          lastTelemetry = t; allTelemetry.push(t)
          throw err
        }
        const backoff = hint ?? Math.min(90_000, 5000 * 2 ** (attempts - 1)) + Math.floor(Math.random() * 500)
        opts.log?.(`  [gateway] ${status} on ${model}, retry ${attempts}/${opts.maxRetries} in ${Math.round(backoff / 1000)}s`)
        waitedMs += backoff
        await sleep(backoff)
      }
    }
  }

  models.generateContent = wrapped
  models.__evalPatched = true
}
