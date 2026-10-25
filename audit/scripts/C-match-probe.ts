/**
 * FILE: audit/scripts/C-match-probe.ts
 *
 * WHAT THIS DOES:
 *   Session C audit helper. Runs the app's matchItem (lib/scan/match.ts) and
 *   inferQtyPrice path on a few bill lines against the kirana sample catalog
 *   and prints match state, product, and Fuse scores. No AI calls.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Evidence for findings-C.md (catalog matching). Not app code.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually ; imports lib/scan/match.ts, eval/lib/catalog.ts, fuse.js
 */
import Fuse from 'fuse.js'
import { matchItem } from '@/lib/scan/match'
import { baseName } from '@/lib/scan/normalize'
import { VOICE_CATALOG } from '../../eval/lib/catalog'

const queries = process.argv.slice(2).length ? process.argv.slice(2) : ['Tata Salt', 'Salt', 'Parle-G Biscuits', 'Aashirvaad Atta', 'Fortune Sun Oil', 'Sooji', 'Amul Butter', 'Maggi', 'Dairy Milk', 'Thums Up']
const indexed = VOICE_CATALOG.map(e => ({ ...e, base: baseName(e.name) }))
const fuse = new Fuse(indexed, { keys: ['base', 'brand'], includeScore: true, ignoreLocation: true, threshold: 0.6 })
for (const q of queries) {
  const m = matchItem({ normalizedName: q, sizeToken: null }, VOICE_CATALOG)
  const top = fuse.search(q.toLowerCase()).slice(0, 3).map(r => `${r.item.name}=${(r.score ?? 1).toFixed(3)}`).join(', ')
  console.log(`${q.padEnd(18)} -> ${m.matchState.padEnd(14)} ${m.matchedProductName ?? (m.candidates[0]?.name ? '(cand) ' + m.candidates[0].name : '-')} | top: ${top}`)
}
