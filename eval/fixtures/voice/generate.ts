/**
 * FILE: eval/fixtures/voice/generate.ts
 *
 * WHAT THIS DOES:
 *   Builds the voice fixture audio. For source=tts fixtures it asks Gemini TTS
 *   to read the Hinglish text in an Indian voice, wraps the 24 kHz PCM in a WAV
 *   and re-encodes it to webm/opus (what MediaRecorder sends in production).
 *   Then it derives: white-noise and babble variants, a real-shop-noise
 *   variant (private, mixed with the merchant's recording), a 2 s silent clip,
 *   and a ~60 s run-on clip (every item phrase back to back with gaps shorter
 *   than the 900 ms VAD cut, i.e. what a busy counter produces).
 *
 *   TTS responses are cached through the eval gateway, so reruns are free.
 *   Run: FFMPEG=<path to ffmpeg> npx tsx eval/fixtures/voice/generate.ts [--tts-model <m>]
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   One-off fixture builder for eval/run.ts --task voice.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually ; uses eval/lib/env.ts, eval/lib/gateway.ts, @google/genai, ffmpeg
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { GoogleGenAI } from '@google/genai'
import { loadEnvLocal } from '../../lib/env'
import { installGateway } from '../../lib/gateway'

const DIR = __dirname
const AUDIO = path.join(DIR, 'audio')
const PRIVATE = path.join(DIR, 'private')

interface Fx { id: string; source: string; voice?: string; text: string; base?: string; effect?: string; seconds?: number }

function ff(args: string[]) {
  const bin = process.env.FFMPEG
  if (!bin) throw new Error('set FFMPEG to an ffmpeg binary path')
  execFileSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
}

function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

const OPUS = ['-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k']

async function main() {
  loadEnvLocal()
  const argv = process.argv.slice(2)
  const ttsModels = argv.includes('--tts-model')
    ? [argv[argv.indexOf('--tts-model') + 1]]
    : ['gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-tts']
  const spec = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures.json'), 'utf8')) as { fixtures: Fx[]; robustness: Fx[] }
  fs.mkdirSync(AUDIO, { recursive: true })

  const key = process.env.GOOGLE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY missing')
  const ai = new GoogleGenAI({ apiKey: key })
  installGateway(ai, { cacheDir: path.join(DIR, '..', '..', 'cache', 'tts'), delayMs: 7000, maxRetries: 3, useCache: true, log: console.log })

  for (const f of spec.fixtures.filter(x => x.source === 'tts')) {
    const out = path.join(AUDIO, `${f.id}.webm`)
    if (fs.existsSync(out)) continue
    let pcm: Buffer | null = null
    for (const model of ttsModels) {
      try {
        const resp = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: `Say this quickly and casually, the way a busy Indian kirana shopkeeper speaks Hinglish at the counter: ${f.text}` }] }],
          config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: f.voice ?? 'Kore' } } } },
        })
        const data = resp.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)?.inlineData?.data
        if (data) { pcm = Buffer.from(data, 'base64'); break }
      } catch (e) {
        console.log(`  ${f.id}: ${model} failed: ${(e as Error).message.slice(0, 120)}`)
      }
    }
    if (!pcm) { console.log(`  ${f.id}: no TTS audio, skipped`); continue }
    const tmp = path.join(AUDIO, `${f.id}.wav`)
    fs.writeFileSync(tmp, wav(pcm, 24000))
    ff(['-i', tmp, ...OPUS, out])
    fs.unlinkSync(tmp)
    console.log(`  ${f.id}: ok`)
  }

  const src = (id: string) => path.join(AUDIO, `${id}.webm`)
  for (const f of [...spec.fixtures, ...spec.robustness].filter(x => x.source === 'derived')) {
    const isPrivate = f.effect === 'shop_bed'
    const out = path.join(isPrivate ? PRIVATE : AUDIO, `${f.id}.webm`)
    if (fs.existsSync(out)) continue
    if (f.base && !fs.existsSync(src(f.base))) { console.log(`  ${f.id}: base ${f.base} missing, skipped`); continue }
    switch (f.effect) {
      case 'white_noise': // roughly 5 dB SNR against TTS speech
        ff(['-i', src(f.base!), '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.12:sample_rate=48000',
          '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:normalize=0', ...OPUS, out]); break
      case 'babble': { // two other speakers underneath
        const a = src('C07'), b = src('V09')
        ff(['-i', src(f.base!), '-i', a, '-i', b, '-filter_complex',
          '[1:a]volume=0.55,aloop=loop=3:size=480000[x];[2:a]volume=0.55,adelay=400,aloop=loop=3:size=480000[y];[0:a][x][y]amix=inputs=3:duration=first:normalize=0',
          ...OPUS, out]); break
      }
      case 'shop_bed': // real counter noise from the merchant recording (private)
        ff(['-i', src(f.base!), '-ss', '20', '-i', path.join(PRIVATE, 'shopbed.webm'), '-filter_complex',
          '[1:a]volume=0.7[n];[0:a][n]amix=inputs=2:duration=first:normalize=0', ...OPUS, out]); break
      case 'silence':
        ff(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono`, '-t', String(f.seconds ?? 2), ...OPUS, out]); break
      case 'concat_items': { // ~60 s of back-to-back item phrases, 0.4 s gaps (< VAD 900 ms)
        const ids = spec.fixtures.filter(x => x.source === 'tts' && x.id.startsWith('V')).map(x => x.id).filter(id => fs.existsSync(src(id)))
        const list = path.join(AUDIO, '_concat.txt')
        const gap = path.join(AUDIO, '_gap.webm')
        ff(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '0.4', ...OPUS, gap])
        const seq: string[] = []
        for (let r = 0; r < 4; r++) for (const id of ids) seq.push(`file '${src(id).replace(/\\/g, '/')}'`, `file '${gap.replace(/\\/g, '/')}'`)
        fs.writeFileSync(list, seq.join('\n'))
        ff(['-f', 'concat', '-safe', '0', '-i', list, '-t', '60', ...OPUS, out])
        fs.unlinkSync(list); fs.unlinkSync(gap)
        fs.writeFileSync(path.join(AUDIO, `${f.id}.order.json`), JSON.stringify(ids))
        break
      }
    }
    console.log(`  ${f.id}: derived (${f.effect})`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
