// Session C helper: list Gemini models reachable with GOOGLE_AI_API_KEY (no key printed).
import fs from 'node:fs'
const env = fs.readFileSync('.env.local', 'utf8')
const key = env.match(/^GOOGLE_AI_API_KEY\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '')
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`)
const j = await res.json()
for (const m of j.models ?? []) console.log(m.name, '|', (m.supportedGenerationMethods ?? []).join(','))
if (!j.models) console.log(JSON.stringify(j).slice(0, 400))
