// Session C helper: READ-ONLY counts showing whether scan corrections are used in practice.
// Uses the Supabase REST API (service role, select only). Prints no secrets.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').replace(/^﻿/, '').split(/\r?\n/)
  .map(l => l.match(/^([A-Z_]+)\s*=\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const count = async (t, f = q => q) => { const { count, error } = await f(sb.from(t).select('id', { count: 'exact', head: true })); return error ? 'ERR ' + error.message : count }
console.log('extraction_corrections total:', await count('extraction_corrections'))
const { data: corr } = await sb.from('extraction_corrections').select('store_id, field_name, original_value, corrected_value, created_at').order('created_at', { ascending: false }).limit(10)
console.log('latest corrections:', JSON.stringify(corr))
console.log('document_uploads total:', await count('document_uploads'))
for (const s of ['pending', 'extracted', 'failed', 'confirmed']) console.log(' uploads', s, await count('document_uploads', q => q.eq('extraction_status', s)))
const { data: lastUp } = await sb.from('document_uploads').select('created_at, extraction_status').order('created_at', { ascending: false }).limit(5)
console.log('last uploads:', JSON.stringify(lastUp))
for (const s of ['bill_scan', 'voice', 'manual_quick', 'manual_full']) console.log(' tx source', s, await count('transactions', q => q.eq('source', s)))
