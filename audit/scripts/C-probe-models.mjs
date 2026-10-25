// Session C helper: one tiny generateContent per model to see which respond right now.
import fs from 'node:fs'
import { GoogleGenAI } from '@google/genai'
const key = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').match(/^GOOGLE_AI_API_KEY\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '')
const ai = new GoogleGenAI({ apiKey: key })
const models = process.argv.slice(2)
for (const model of models) {
  const t0 = Date.now()
  try {
    const r = await ai.models.generateContent({ model, contents: 'Reply with the single word OK.', config: { maxOutputTokens: 256 } })
    console.log(model, 'OK', Date.now() - t0, 'ms', JSON.stringify(r.text?.trim()), 'modelVersion=', r.modelVersion, 'thoughts=', r.usageMetadata?.thoughtsTokenCount)
  } catch (e) { console.log(model, 'ERR', Date.now() - t0, 'ms', e.status, String(e.message).slice(0, 140)) }
}
