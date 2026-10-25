/**
 * FILE: eval/lib/providers/types.ts
 *
 * WHAT THIS DOES:
 *   The provider seam. A provider turns one fixture input (an image, or an
 *   audio clip) into the SAME intermediate shape the app produces:
 *     - scan:  RawExtraction  (lib/anthropic/extraction.ts output)
 *     - voice: VoiceParseResult (lib/anthropic/voiceParse.ts output)
 *   Everything after that (catalog matching, qty/price inference, cart rows,
 *   command decisions, scoring) is the app's own code plus eval scoring, and
 *   is shared by every provider. To plug in Sarvam, an open-source VLM, or a
 *   local Whisper + LLM, implement these interfaces and register the provider
 *   in eval/lib/providers/index.ts. No scoring code changes.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Implemented by eval/lib/providers/gemini.ts; consumed by eval/lib/tasks/*.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/lib/providers/*, eval/lib/tasks/* ; types from the app
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RawExtraction } from '@/lib/anthropic/extraction'
import type { VoiceParseResult } from '@/lib/voice/types'
import type { CallTelemetry } from '../gateway'

export interface ScanInput {
  imageBase64: string
  mimeType: string
  // Fake Supabase holding the store's extraction_corrections (few-shot) table.
  supabase: SupabaseClient
  storeId: string
}

export interface VoiceInput {
  audioBase64: string
  mimeType: string
  catalogNames: string[]   // transcription bias list, built exactly like the route does
}

export interface ProviderResult<T> {
  output: T | null
  error: { kind: ErrorKind; status?: number; message: string } | null
  telemetry: CallTelemetry[]
}

export type ErrorKind = 'json_parse' | 'http' | 'empty' | 'other'

export interface ScanProvider {
  name: string
  model: string
  extract(input: ScanInput): Promise<ProviderResult<RawExtraction>>
}

export interface VoiceProvider {
  name: string
  model: string
  parse(input: VoiceInput): Promise<ProviderResult<VoiceParseResult> & { rawText?: string }>
}

export interface ProviderOptions {
  model: string
  cacheDir: string
  delayMs: number
  maxRetries: number
  useCache: boolean
  injectError?: number
  log: (msg: string) => void
}
