/**
 * FILE: audit/scripts/B-rls-proof.ts
 *
 * WHAT THIS DOES:
 *   Live cross-tenant RLS proof for Session B. Creates two confirmed users
 *   (audit-b-1, audit-b-2) with their own stores, has user 1 insert a row in
 *   every tenant table plus a file in the "documents" bucket, then has user 2
 *   (anon key + own JWT, exactly what a browser has) try to SELECT, UPDATE,
 *   DELETE and cross-INSERT user 1's data. Any success is a P0.
 *   Also probes: anon (no session) reads, kaggle_products writes, own-row
 *   UPDATE on document_uploads (no UPDATE policy in 001), cross-tenant FK
 *   references, and storage update/delete.
 *
 * SAFETY:
 *   Refuses to run unless AUDIT_B_SUPABASE_URL is set AND differs from the
 *   NEXT_PUBLIC_SUPABASE_URL in .env.local (the main project). The service
 *   role key is used ONLY to create/confirm the two audit users, to verify
 *   ground truth after each attack, and to clean up. Every attack uses the
 *   anon key.
 *
 * RUN (from repo root, against a DEDICATED project with migrations 001-008):
 *   AUDIT_B_SUPABASE_URL=... AUDIT_B_ANON_KEY=... AUDIT_B_SERVICE_ROLE_KEY=... \
 *     npx tsx audit/scripts/B-rls-proof.ts
 *   Output: console table + audit/scripts/B-rls-results.json
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'

const URL_ = process.env.AUDIT_B_SUPABASE_URL ?? ''
const ANON = process.env.AUDIT_B_ANON_KEY ?? ''
const SERVICE = process.env.AUDIT_B_SERVICE_ROLE_KEY ?? ''

function mainProjectUrl(): string {
  try {
    const env = readFileSync('.env.local', 'utf8')
    return env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1]?.replace(/["']/g, '') ?? ''
  } catch { return '' }
}

if (!URL_ || !ANON || !SERVICE) {
  console.error('Set AUDIT_B_SUPABASE_URL, AUDIT_B_ANON_KEY, AUDIT_B_SERVICE_ROLE_KEY for a dedicated audit project.')
  process.exit(2)
}
if (URL_ === mainProjectUrl()) {
  console.error('Refusing: AUDIT_B_SUPABASE_URL is the main project from .env.local. Use a dedicated audit project.')
  process.exit(2)
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
const PASSWORD = `AuditB-${randomUUID()}`
const RUN = Date.now()

type Result = { target: string; attack: string; outcome: 'BLOCKED' | 'LEAK' | 'NOTE'; detail: string }
const results: Result[] = []
const record = (target: string, attack: string, leaked: boolean, detail: string) =>
  results.push({ target, attack, outcome: leaked ? 'LEAK' : 'BLOCKED', detail })
const note = (target: string, attack: string, detail: string) =>
  results.push({ target, attack, outcome: 'NOTE', detail })

async function makeUser(tag: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `audit-b-${tag}-${RUN}@example.com`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser ${tag}: ${error?.message}`)
  const client = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`)
  return { id: data.user.id, client }
}

async function ins(c: SupabaseClient, table: string, row: Record<string, unknown>) {
  const { data, error } = await c.from(table).insert(row).select('id').single()
  if (error || !data) throw new Error(`${table} insert as owner failed: ${error?.message}`)
  return data.id as string
}

async function main() {
  const u1 = await makeUser('1')
  const u2 = await makeUser('2')
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } })

  const today = new Date().toISOString().slice(0, 10)
  // ── user 1 builds a full store through RLS (also proves owner INSERT works)
  const store1 = await ins(u1.client, 'stores', { owner_id: u1.id, name: 'Audit B One', type: 'kirana', owner_name: 'B1', city: 'Jaipur' })
  const store2 = await ins(u2.client, 'stores', { owner_id: u2.id, name: 'Audit B Two', type: 'kirana', owner_name: 'B2', city: 'Pune' })
  const product = await ins(u1.client, 'products', { store_id: store1, item_number: 0, name: 'Secret Product', unit: 'piece' })
  const customer = await ins(u1.client, 'customers', { store_id: store1, name: 'Secret Customer', current_balance: 500 })
  const fixedCost = await ins(u1.client, 'fixed_costs', { store_id: store1, name: 'Rent', amount: 15000, frequency: 'monthly', category: 'rent' })
  const txId = await ins(u1.client, 'transactions', { store_id: store1, user_id: u1.id, date: today, type: 'sale', total_amount: 500, source: 'manual_quick', payment_method: 'credit', customer_id: customer })
  const docPath = `${u1.id}/${randomUUID()}.txt`

  // stores is attacked LAST so a successful cross-tenant delete cannot cascade
  // away the child rows before their own probes run.
  const owned: Record<string, string> = {
    products: product,
    customers: customer,
    fixed_costs: fixedCost,
    transactions: txId,
    inventory: await ins(u1.client, 'inventory', { store_id: store1, product_id: product, current_stock: 10 }),
    transaction_items: await ins(u1.client, 'transaction_items', { transaction_id: txId, product_id: product, product_name_raw: 'Secret Product', quantity: 1, unit_price: 500, total_price: 500 }),
    stock_movements: await ins(u1.client, 'stock_movements', { store_id: store1, product_id: product, movement_type: 'sale', quantity: 1, transaction_id: txId }),
    document_uploads: await ins(u1.client, 'document_uploads', { store_id: store1, user_id: u1.id, storage_path: docPath, file_type: 'text/plain', document_type: 'single_bill' }),
    extraction_corrections: await ins(u1.client, 'extraction_corrections', { store_id: store1, field_name: 'product_name', original_value: 'a', corrected_value: 'b' }),
    ai_conversations: await ins(u1.client, 'ai_conversations', { store_id: store1, messages: [] }),
    periodic_reports: await ins(u1.client, 'periodic_reports', { store_id: store1, report_type: 'weekly', period_start: today, period_end: today, share_token: randomUUID() }),
    cash_reconciliations: await ins(u1.client, 'cash_reconciliations', { store_id: store1, date: today, counted_cash: 1234 }),
    fixed_cost_overrides: await ins(u1.client, 'fixed_cost_overrides', { fixed_cost_id: fixedCost, month: today.slice(0, 7), amount: 18000 }),
    stores: store1,
  }

  // ── attacks per table
  for (const [table, id] of Object.entries(owned)) {
    // SELECT as user 2 and as anon
    for (const [who, c] of [['user2', u2.client], ['anon', anon]] as const) {
      const { data } = await c.from(table).select('id').eq('id', id)
      record(table, `${who} SELECT by id`, (data?.length ?? 0) > 0, `rows=${data?.length ?? 0}`)
    }
    // UPDATE as user 2 (PostgREST returns 0 rows when RLS filters, no error)
    const col = table === 'transaction_items' ? 'product_name_raw' : table === 'ai_conversations' ? 'messages'
      : table === 'fixed_cost_overrides' ? 'note' : table === 'periodic_reports' ? 'summary_text'
      : table === 'cash_reconciliations' ? 'note' : table === 'stock_movements' ? 'reason'
      : table === 'inventory' ? 'reorder_point' : table === 'document_uploads' ? 'extraction_status'
      : table === 'extraction_corrections' ? 'corrected_value' : table === 'stores' ? 'city' : 'name'
    const val = col === 'messages' ? [{ role: 'user', content: 'pwned' }] : col === 'reorder_point' ? 999 : 'pwned-by-b2'
    await u2.client.from(table).update({ [col]: val }).eq('id', id)
    const { data: after } = await admin.from(table).select(col).eq('id', id).single()
    record(table, 'user2 UPDATE', JSON.stringify((after as Record<string, unknown>)?.[col]) === JSON.stringify(val), `${col} now=${JSON.stringify((after as Record<string, unknown>)?.[col])}`)
    // DELETE as user 2
    await u2.client.from(table).delete().eq('id', id)
    const { data: still } = await admin.from(table).select('id').eq('id', id)
    record(table, 'user2 DELETE', (still?.length ?? 0) === 0, `row still exists=${(still?.length ?? 0) > 0}`)
  }

  // ── cross-INSERT into user 1's store (WITH CHECK)
  const crossInserts: Array<[string, Record<string, unknown>]> = [
    ['products', { store_id: store1, item_number: 0, name: 'Injected', unit: 'piece' }],
    ['customers', { store_id: store1, name: 'Injected' }],
    ['transactions', { store_id: store1, user_id: u2.id, date: today, type: 'sale', total_amount: 1, source: 'manual_quick' }],
    ['transaction_items', { transaction_id: txId, product_name_raw: 'Injected', quantity: 1, unit_price: 1, total_price: 1 }],
    ['stock_movements', { store_id: store1, product_id: product, movement_type: 'sale', quantity: 1 }],
    ['fixed_cost_overrides', { fixed_cost_id: fixedCost, month: '2099-01', amount: 1 }],
    ['cash_reconciliations', { store_id: store1, date: '2099-01-01' }],
    ['stores', { owner_id: u1.id, name: 'Store owned by u1 created by u2', type: 'kirana', owner_name: 'x', city: 'x' }],
  ]
  for (const [table, row] of crossInserts) {
    const { data, error } = await u2.client.from(table).insert(row).select('id')
    record(table, 'user2 INSERT into user1 store', !error && (data?.length ?? 0) > 0, error ? error.message : `inserted=${data?.length}`)
  }

  // ── cross-tenant FK references from user 2's OWN store (RLS checks store_id only)
  {
    const { data, error } = await u2.client.from('transactions')
      .insert({ store_id: store2, user_id: u2.id, date: today, type: 'sale', total_amount: 1, source: 'manual_quick', customer_id: customer })
      .select('id')
    const ok = !error && (data?.length ?? 0) > 0
    results.push({ target: 'transactions', attack: 'user2 own tx referencing user1 customer_id', outcome: ok ? 'LEAK' : 'BLOCKED', detail: ok ? 'FK accepted foreign customer (integrity, not read leak)' : (error?.message ?? '') })
    const { data: inv, error: invErr } = await u2.client.from('inventory').insert({ store_id: store2, product_id: product, current_stock: 1 }).select('id')
    const ok2 = !invErr && (inv?.length ?? 0) > 0
    results.push({ target: 'inventory', attack: 'user2 own inventory row for user1 product_id', outcome: ok2 ? 'LEAK' : 'BLOCKED', detail: ok2 ? 'accepted' : (invErr?.message ?? '') })
  }

  // ── own-row UPDATE on document_uploads (scan route depends on it)
  {
    const { data } = await u1.client.from('document_uploads').update({ extraction_status: 'confirmed' }).eq('id', owned.document_uploads).select('id')
    note('document_uploads', 'user1 UPDATE own row (scan status/raw json)', `rowsUpdated=${data?.length ?? 0} (0 means scan status + raw_extraction_json are never saved)`)
  }

  // ── kaggle_products: no RLS by design. Can a plain user or anon WRITE it?
  for (const [who, c] of [['user2', u2.client], ['anon', anon]] as const) {
    const { data, error } = await c.from('kaggle_products').insert({ store_type: 'kirana', name: `audit-b-${who}` }).select('id')
    const ok = !error && (data?.length ?? 0) > 0
    record('kaggle_products', `${who} INSERT`, ok, error?.message ?? `inserted=${data?.length}`)
    if (ok) await admin.from('kaggle_products').delete().eq('id', data![0].id)
  }

  // ── periodic_reports share-token enumeration as anon
  {
    const { data } = await anon.from('periodic_reports').select('id, share_token').not('share_token', 'is', null)
    record('periodic_reports', 'anon enumerate share_token rows', (data?.length ?? 0) > 0, `rows=${data?.length ?? 0}`)
  }

  // ── storage bucket "documents"
  {
    const up = await u1.client.storage.from('documents').upload(docPath, new Blob(['secret bill']), { contentType: 'text/plain' })
    if (up.error) note('storage:documents', 'user1 upload own file', `failed: ${up.error.message}`)
    const dl = await u2.client.storage.from('documents').download(docPath)
    record('storage:documents', 'user2 download user1 file', !dl.error && !!dl.data, dl.error?.message ?? 'downloaded')
    const ls = await u2.client.storage.from('documents').list(u1.id)
    record('storage:documents', 'user2 list user1 folder', (ls.data?.length ?? 0) > 0, `entries=${ls.data?.length ?? 0}`)
    const ow = await u2.client.storage.from('documents').upload(docPath, new Blob(['overwritten']), { upsert: true })
    record('storage:documents', 'user2 overwrite user1 file', !ow.error, ow.error?.message ?? 'overwritten')
    const plant = await u2.client.storage.from('documents').upload(`${u1.id}/planted.txt`, new Blob(['x']))
    record('storage:documents', 'user2 upload into user1 folder', !plant.error, plant.error?.message ?? 'planted')
    const rm = await u2.client.storage.from('documents').remove([docPath])
    const exists = await admin.storage.from('documents').download(docPath)
    record('storage:documents', 'user2 delete user1 file', !exists.data, `still exists=${!!exists.data} removeResp=${JSON.stringify(rm.data)}`)
    const ownRm = await u1.client.storage.from('documents').remove([docPath])
    const exists2 = await admin.storage.from('documents').download(docPath)
    note('storage:documents', 'user1 delete OWN file (scan cleanup path)', `still exists=${!!exists2.data} (true means no DELETE policy, orphaned scans) resp=${JSON.stringify(ownRm.data)}`)
    const anonDl = await anon.storage.from('documents').download(docPath)
    record('storage:documents', 'anon download', !anonDl.error && !!anonDl.data, anonDl.error?.message ?? 'downloaded')
    const { data: buckets } = await admin.storage.listBuckets()
    note('storage', 'bucket inventory', JSON.stringify((buckets ?? []).map(b => ({ name: b.name, public: b.public }))))
  }

  // ── cleanup (stores cascade to children; owner_id has no FK to auth.users)
  await admin.storage.from('documents').remove([docPath, `${u1.id}/planted.txt`])
  await admin.from('stores').delete().in('owner_id', [u1.id, u2.id])
  await admin.auth.admin.deleteUser(u1.id)
  await admin.auth.admin.deleteUser(u2.id)

  console.table(results)
  writeFileSync('audit/scripts/B-rls-results.json', JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2))
  const leaks = results.filter(r => r.outcome === 'LEAK')
  console.log(leaks.length ? `\n${leaks.length} LEAK(S). Each is a finding (P0 if cross-tenant read/write/delete).` : '\nNo leaks.')
  process.exit(leaks.length ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(3) })
