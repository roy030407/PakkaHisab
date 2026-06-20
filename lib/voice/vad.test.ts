import { describe, it, expect } from 'vitest'
import { computeRms, initVadState, advanceVad } from '@/lib/voice/vad'

describe('computeRms', () => {
  it('is zero for silence', () => {
    expect(computeRms(new Float32Array([0, 0, 0, 0]))).toBe(0)
  })
  it('is the root-mean-square of the samples', () => {
    // rms of [0.5, -0.5] = sqrt((0.25 + 0.25) / 2) = 0.5
    expect(computeRms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5, 6)
  })
  it('is zero for an empty buffer', () => {
    expect(computeRms(new Float32Array([]))).toBe(0)
  })
})

describe('advanceVad', () => {
  const opts = { threshold: 0.02, silenceMs: 900, minSpeechMs: 300 }

  it('does not finalize on silence before any speech', () => {
    let s = initVadState()
    for (let i = 0; i < 30; i++) {
      const r = advanceVad(s, 0.0, 50, opts)
      s = r.state
      expect(r.finalize).toBe(false)
    }
    expect(s.speaking).toBe(false)
  })

  it('finalizes after enough speech then ~900ms of trailing silence', () => {
    let s = initVadState()
    // 400ms of speech (8 loud frames of 50ms)
    for (let i = 0; i < 8; i++) s = advanceVad(s, 0.1, 50, opts).state
    expect(s.speaking).toBe(true)
    // 850ms of silence: not yet
    let finalized = false
    for (let i = 0; i < 17; i++) {
      const r = advanceVad(s, 0.0, 50, opts)
      s = r.state
      finalized = finalized || r.finalize
    }
    expect(finalized).toBe(false)
    // one more 50ms frame crosses 900ms -> finalize
    const r = advanceVad(s, 0.0, 50, opts)
    expect(r.finalize).toBe(true)
    expect(r.state).toEqual(initVadState()) // resets for the next phrase
  })

  it('ignores a brief blip shorter than minSpeechMs', () => {
    let s = initVadState()
    s = advanceVad(s, 0.1, 50, opts).state // 50ms of speech only
    let finalized = false
    for (let i = 0; i < 30; i++) {
      const r = advanceVad(s, 0.0, 50, opts)
      s = r.state
      finalized = finalized || r.finalize
    }
    expect(finalized).toBe(false)
  })
})
