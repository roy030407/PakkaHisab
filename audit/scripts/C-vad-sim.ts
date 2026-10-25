/**
 * FILE: audit/scripts/C-vad-sim.ts
 *
 * WHAT THIS DOES:
 *   Session C audit helper. Replays a real recording through the app's own
 *   VAD (lib/voice/vad.ts advanceVad + computeRms) the way hooks/useVoiceSession
 *   drives it: every 50 ms, RMS over the latest 1024 samples at 48 kHz.
 *   Prints the RMS distribution and every segment the app would have sent,
 *   at the shipped threshold and at a few alternatives.
 *
 *   Input: mono 48 kHz float32 little-endian raw PCM (ffmpeg -f f32le).
 *   Run: npx tsx audit/scripts/C-vad-sim.ts <file.f32> [startSec] [endSec]
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Audit evidence for findings-C.md Part 5 (VAD thresholds). Not app code.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually ; imports lib/voice/vad.ts
 */
import fs from 'node:fs'
import { advanceVad, computeRms, initVadState, VAD_SILENCE_THRESHOLD } from '@/lib/voice/vad'

const SR = 48000
const FRAME_MS = 50
const WIN = 1024

function main() {
  const [file, startArg, endArg] = process.argv.slice(2)
  const buf = fs.readFileSync(file)
  const all = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4))
  const s0 = Math.floor(Number(startArg ?? 0) * SR)
  const s1 = endArg ? Math.floor(Number(endArg) * SR) : all.length
  const pcm = all.subarray(s0, s1)
  const hop = Math.round(SR * FRAME_MS / 1000)

  const rmsSeries: number[] = []
  for (let i = WIN; i <= pcm.length; i += hop) rmsSeries.push(computeRms(pcm.subarray(i - WIN, i)))
  const sorted = [...rmsSeries].sort((a, b) => a - b)
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  const db = (x: number) => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1)
  console.log(`duration ${(pcm.length / SR).toFixed(1)}s, frames ${rmsSeries.length}`)
  console.log(`RMS p10 ${pct(0.1).toFixed(4)} (${db(pct(0.1))} dBFS)  p50 ${pct(0.5).toFixed(4)} (${db(pct(0.5))})  p90 ${pct(0.9).toFixed(4)} (${db(pct(0.9))})`)
  console.log(`frames at/above shipped threshold ${VAD_SILENCE_THRESHOLD}: ${(100 * rmsSeries.filter(r => r >= VAD_SILENCE_THRESHOLD).length / rmsSeries.length).toFixed(1)}%`)

  for (const threshold of [VAD_SILENCE_THRESHOLD, 0.03, 0.05, 0.08]) {
    let st = initVadState()
    let segStart: number | null = null
    const segs: string[] = []
    let longest = 0
    rmsSeries.forEach((rms, idx) => {
      const t = idx * FRAME_MS / 1000 + Number(startArg ?? 0)
      const was = st.speaking
      const r = advanceVad(st, rms, FRAME_MS, { threshold })
      st = r.state
      if (!was && st.speaking) segStart = t
      if (r.finalize && segStart !== null) {
        segs.push(`${segStart.toFixed(1)}-${t.toFixed(1)}`)
        longest = Math.max(longest, t - segStart)
        segStart = null
      }
    })
    const open = segStart !== null ? ` + 1 never-finalized segment open since ${(segStart as number).toFixed(1)}s` : ''
    console.log(`threshold ${threshold}: ${segs.length} segments sent, longest ${longest.toFixed(1)}s${open}`)
    if (segs.length) console.log(`  ${segs.slice(0, 25).join(', ')}${segs.length > 25 ? ' ...' : ''}`)
  }
}

main()
