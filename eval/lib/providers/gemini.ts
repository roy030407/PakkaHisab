/**
 * FILE: eval/lib/providers/gemini.ts
 *
 * WHAT THIS DOES:
 *   The production provider. Sets GEMINI_MODEL, then dynamically imports the
 *   app's own extractBillData / parseVoiceAudio (so the exact production
 *   prompts, config and parsing run), and installs the eval gateway on the
 *   app's Gemini client singleton for caching, pacing, retries and telemetry.
 *
 *   GEMINI_MODEL must be set before lib/anthropic/client.ts is first imported,
 *   because DEFAULT_GEMINI_MODEL is read once at module load. That is why the
 *   imports here are dynamic.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Registered in eval/lib/providers/index.ts as "gemini".
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/lib/providers/index.ts ; imports lib/anthropic/{client,extraction,voiceParse}
 */
import type { ScanProvider, VoiceProvider, ProviderOptions, ProviderResult, ErrorKind } from './types'
import { installGateway, takeTelemetry } from '../gateway'

async function boot(opts: ProviderOptions) {
  process.env.GEMINI_MODEL = opts.model
  const client = await import('@/lib/anthropic/client')
  if (client.DEFAULT_GEMINI_MODEL !== opts.model) {
    throw new Error(`app client already loaded with model ${client.DEFAULT_GEMINI_MODEL}; one model per process`)
  }
  installGateway(client.getGeminiClient(), {
    cacheDir: opts.cacheDir,
    delayMs: opts.delayMs,
    maxRetries: opts.maxRetries,
    useCache: opts.useCache,
    injectError: opts.injectError,
    log: opts.log,
  })
}

function classify(err: unknown): { kind: ErrorKind; status?: number; message: string } {
  const message = err instanceof Error ? err.message : String(err)
  if (err instanceof SyntaxError) return { kind: 'json_parse', message: message.slice(0, 300) }
  const status = (err as { status?: unknown })?.status
  if (typeof status === 'number') return { kind: 'http', status, message: message.slice(0, 300) }
  return { kind: 'other', message: message.slice(0, 300) }
}

export async function geminiScanProvider(opts: ProviderOptions): Promise<ScanProvider> {
  await boot(opts)
  const { extractBillData } = await import('@/lib/anthropic/extraction')
  return {
    name: 'gemini',
    model: opts.model,
    async extract(input) {
      takeTelemetry()
      try {
        const output = await extractBillData(input.supabase, input.storeId, input.imageBase64, input.mimeType)
        return { output, error: null, telemetry: takeTelemetry() }
      } catch (err) {
        return { output: null, error: classify(err), telemetry: takeTelemetry() }
      }
    },
  }
}

export async function geminiVoiceProvider(opts: ProviderOptions): Promise<VoiceProvider> {
  await boot(opts)
  const { parseVoiceAudio } = await import('@/lib/anthropic/voiceParse')
  return {
    name: 'gemini',
    model: opts.model,
    async parse(input) {
      takeTelemetry()
      try {
        const output = await parseVoiceAudio(input.audioBase64, input.mimeType, input.catalogNames)
        const telemetry = takeTelemetry()
        const rawText = telemetry[telemetry.length - 1]?.responseText
        // parseVoiceAudio swallows JSON.parse errors and returns an empty result.
        // Surface that here so the eval counts it instead of hiding it like prod does.
        let error: ProviderResult<unknown>['error'] = null
        if (rawText !== undefined) {
          let t = rawText.trim()
          if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
          try { JSON.parse(t) } catch { error = { kind: t ? 'json_parse' : 'empty', message: `silently swallowed by app: ${t.slice(0, 120)}` } }
        }
        return { output, error, telemetry, rawText }
      } catch (err) {
        return { output: null, error: classify(err), telemetry: takeTelemetry() }
      }
    },
  }
}
