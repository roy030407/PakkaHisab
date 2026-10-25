/**
 * FILE: eval/fixtures/scan/prepare.ts
 *
 * WHAT THIS DOES:
 *   Builds eval/fixtures/scan/img/ from the fixture list. Real images are
 *   resized to max 1280 px on the long side, mirroring the browser-image-
 *   compression step in app/(dashboard)/scan/page.tsx (maxWidthOrHeight 1280,
 *   original format kept). Derived fixtures (blur, low-res, dark+noise, blank
 *   page, ~10 MB photo) are rendered with ffmpeg.
 *   Run: FFMPEG=<path> npx tsx eval/fixtures/scan/prepare.ts
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   One-off fixture builder for eval/run.ts --task scan.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually ; uses ffmpeg and eval/lib/env.ts (REPO_ROOT)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { REPO_ROOT } from '../../lib/env'

interface Fx { id: string; src?: string; srcPrivate?: string; derivedFrom?: string; effect?: string }

const IMG = path.join(__dirname, 'img')
const FIT = "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'"

function ff(args: string[]) {
  const bin = process.env.FFMPEG
  if (!bin) throw new Error('set FFMPEG to an ffmpeg binary path')
  execFileSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
}

export function preparedPath(id: string, all: Fx[]): string {
  const f = all.find(x => x.id === id)
  const src = f?.src ?? f?.srcPrivate
  const ext = src ? path.extname(src).toLowerCase().replace('.jpeg', '.jpg') : f?.effect === 'huge' ? '.jpg' : '.png'
  return path.join(IMG, `${id}${ext}`)
}

function main() {
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8')) as { fixtures: Fx[]; robustness: Fx[] }
  const all = [...spec.fixtures, ...spec.robustness]
  fs.mkdirSync(IMG, { recursive: true })
  for (const f of all) {
    const out = preparedPath(f.id, all)
    if (fs.existsSync(out)) continue
    const src = f.src ?? f.srcPrivate
    if (src) {
      ff(['-i', path.join(REPO_ROOT, src), '-vf', FIT, ...(out.endsWith('.jpg') ? ['-q:v', '3'] : []), out])
    } else if (f.derivedFrom) {
      const base = preparedPath(f.derivedFrom, all)
      const vf: Record<string, string> = {
        blur: 'gblur=sigma=3',
        lowres: 'scale=300:-2,scale=1000:-2:flags=bilinear',
        dark_noise: 'eq=brightness=-0.25:contrast=0.7,noise=alls=28:allf=t',
        huge: 'scale=4000:-2:flags=lanczos,noise=alls=8:allf=t',
      }
      ff(['-i', base, '-vf', vf[f.effect ?? ''] ?? 'null', ...(f.effect === 'huge' ? ['-q:v', '1'] : []), out])
    } else if (f.effect === 'blank') {
      ff(['-f', 'lavfi', '-i', 'color=c=white:s=960x1280', '-frames:v', '1', out])
    }
    console.log(`${f.id}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`)
  }
}

if (require.main === module) main()
