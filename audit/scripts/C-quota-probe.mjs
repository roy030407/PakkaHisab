// Session C helper: print the quota details Gemini returns with a 429 (limit, metric, retryDelay).
import fs from 'node:fs'
import { GoogleGenAI } from '@google/genai'
const key = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').match(/^GOOGLE_AI_API_KEY\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '')
const ai = new GoogleGenAI({ apiKey: key })
for (const model of process.argv.slice(2)) {
  try { await ai.models.generateContent({ model, contents: 'Say OK', config: { maxOutputTokens: 64 } }); console.log(model, 'OK') }
  catch (e) {
    const m = String(e.message)
    const viol = [...m.matchAll(/"quotaMetric":\s*"([^"]+)"[\s\S]*?"quotaId":\s*"([^"]+)"[\s\S]*?(?:"quotaValue":\s*"(\d+)")?/g)].map(x => `${x[2]} limit=${x[3] ?? '?'}`)
    console.log(model, e.status, viol.join('; ') || m.slice(0, 300), (m.match(/retryDelay"?\s*:\s*"?([\d.]+s)/) ?? [])[1] ?? '')
  }
}
