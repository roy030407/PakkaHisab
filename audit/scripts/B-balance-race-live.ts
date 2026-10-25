/**
 * FILE: audit/scripts/B-balance-race-live.ts
 *
 * WHAT THIS DOES:
 *   Live confirmation of the lost-update race against a REAL Postgres, as
 *   user audit-b-race (anon key + JWT, so RLS applies like production).
 *   - Balance: runs the exact two-query sequence used by entry/quick,
 *     entry/full, scan/confirm and customers/[id]/payment
 *     (select current_balance -> update current_balance = read + amount),
 *     20 times concurrently.
 *   - Stock: calls the real lib/inventory/updateStock.ts 20 times concurrently.
 *   Prints observed vs expected. The in-memory equivalent that drives the
 *   actual route handlers is audit/tests/B-balance-race.test.ts.
 *
 * SAFETY: same guard as B-rls-proof.ts (refuses the main project).
 * RUN: AUDIT_B_SUPABASE_URL=... AUDIT_B_ANON_KEY=... AUDIT_B_SERVICE_ROLE_KEY=... \
 *        npx tsx audit/scripts/B-balance-race-live.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { updateStock } from '../../lib/inventory/updateStock'

const URL_ = process.env.AUDIT_B_SUPABASE_URL ?? ''
const ANON = process.env.AUDIT_B_ANON_KEY ?? ''
const SERVICE = process.env.AUDIT_B_SERVICE_ROLE_KEY ?? ''
const main_ = (() => { try { return readFileSync('.env.local', 'utf8').match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1] ?? '' } catch { return '' } })()
if (!URL_ || !ANON || !SERVICE) { console.error('Set AUDIT_B_* env vars for a dedicated project.'); process.exit(2) }
if (URL_ === main_) { console.error('Refusing: that is the main project.'); process.exit(2) }

const N = 20

async function run() {
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
  const email = `audit-b-race-${Date.now()}@example.com`
  const password = `AuditB-${randomUUID()}`
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  const uid = created.user!.id
  const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
  await sb.auth.signInWithPassword({ email, password })

  const { data: store } = await sb.from('stores').insert({ owner_id: uid, name: 'Audit B Race', type: 'kirana', owner_name: 'B', city: 'X' }).select('id').single()
  const { data: product } = await sb.from('products').insert({ store_id: store!.id, item_number: 0, name: 'P', unit: 'piece', selling_price: 10 }).select('id').single()
  await sb.from('inventory').insert({ store_id: store!.id, product_id: product!.id, current_stock: 1000 })
  const { data: cust } = await sb.from('customers').insert({ store_id: store!.id, name: 'C', current_balance: 0 }).select('id').single()

  // Balance: identical sequence to app/api/entry/quick/route.ts lines 164-177
  await Promise.all(Array.from({ length: N }, async () => {
    const { data: c } = await sb.from('customers').select('current_balance').eq('id', cust!.id).eq('store_id', store!.id).single()
    if (c) await sb.from('customers').update({ current_balance: Number(c.current_balance) + 10 }).eq('id', cust!.id)
  }))
  const { data: after } = await admin.from('customers').select('current_balance').eq('id', cust!.id).single()

  // Stock: the real helper
  const { data: tx } = await sb.from('transactions').insert({ store_id: store!.id, user_id: uid, date: new Date().toISOString().slice(0, 10), type: 'sale', total_amount: 0, source: 'manual_quick' }).select('id').single()
  await Promise.all(Array.from({ length: N }, () =>
    updateStock(sb, { storeId: store!.id, productId: product!.id, delta: -1, transactionId: tx!.id, movementType: 'sale', unitPrice: 10 })))
  const { data: inv } = await admin.from('inventory').select('current_stock').eq('product_id', product!.id).single()

  console.log(`[B-RACE-LIVE] balance observed=${after!.current_balance} expected=${N * 10}`)
  console.log(`[B-RACE-LIVE] stock   observed=${inv!.current_stock} expected=${1000 - N}`)

  await admin.from('stores').delete().eq('id', store!.id)
  await admin.auth.admin.deleteUser(uid)
}

run().catch(e => { console.error(e); process.exit(3) })
