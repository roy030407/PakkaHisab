/**
 * FILE: lib/voice/vad.ts
 *
 * WHAT THIS DOES:
 *   Pure voice-activity-detection helpers for the continuous mic loop. Computes
 *   RMS volume per audio frame and runs a small state machine that finalizes a
 *   spoken phrase after enough speech followed by ~1s of trailing silence.
 *   Thresholds are exported constants so they can be tuned on real devices.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Driven frame-by-frame by hooks/useVoiceSession.ts against an AnalyserNode.
 *
 * CALLED BY / IMPORTS FROM:
 *   hooks/useVoiceSession.ts ; no imports.
 */

// Tune on real devices. RMS is 0..1 on getFloatTimeDomainData output.
export const VAD_SILENCE_THRESHOLD = 0.015 // below this a frame is "silence"
export const VAD_SILENCE_MS = 900          // ~1s of trailing silence ends a phrase
export const VAD_MIN_SPEECH_MS = 300       // ignore blips shorter than this

export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

export interface VadState {
  speaking: boolean
  speechMs: number
  silenceMs: number
}

export function initVadState(): VadState {
  return { speaking: false, speechMs: 0, silenceMs: 0 }
}

export function advanceVad(
  state: VadState,
  rms: number,
  frameMs: number,
  opts: { threshold?: number; silenceMs?: number; minSpeechMs?: number } = {},
): { state: VadState; finalize: boolean } {
  const threshold = opts.threshold ?? VAD_SILENCE_THRESHOLD
  const silenceLimit = opts.silenceMs ?? VAD_SILENCE_MS
  const minSpeech = opts.minSpeechMs ?? VAD_MIN_SPEECH_MS

  let { speaking, speechMs, silenceMs } = state
  const loud = rms >= threshold

  if (loud) {
    speaking = true
    speechMs += frameMs
    silenceMs = 0
  } else if (speaking) {
    silenceMs += frameMs
  }

  const finalize = speaking && speechMs >= minSpeech && silenceMs >= silenceLimit
  const nextState = finalize ? initVadState() : { speaking, speechMs, silenceMs }
  return { state: nextState, finalize }
}
