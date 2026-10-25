/**
 * FILE: eval/lib/providers/index.ts
 *
 * WHAT THIS DOES:
 *   Provider registry. Maps --provider <name> to a factory. Add new backends
 *   (Sarvam Saarika/Saaras for speech, an open-source VLM served by Ollama or
 *   vLLM for bills) here; they only need to return the app's intermediate
 *   shapes (see ./types.ts), and all scoring and reporting is reused.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Used by eval/run.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/run.ts ; eval/lib/providers/gemini.ts
 */
import type { ScanProvider, VoiceProvider, ProviderOptions } from './types'
import { geminiScanProvider, geminiVoiceProvider } from './gemini'

type Factory<T> = (opts: ProviderOptions) => Promise<T>

export const SCAN_PROVIDERS: Record<string, Factory<ScanProvider>> = {
  gemini: geminiScanProvider,
  // sarvam: sarvamScanProvider,   // example: implement extract() -> RawExtraction
  // ollama: ollamaScanProvider,
}

export const VOICE_PROVIDERS: Record<string, Factory<VoiceProvider>> = {
  gemini: geminiVoiceProvider,
  // sarvam: sarvamVoiceProvider,  // example: STT + small LLM -> VoiceParseResult
}
