/**
 * FILE: app/api/voice/parse/route.ts
 *
 * WHAT THIS DOES:
 *   POST: receives one spoken-phrase audio clip (multipart "audio"), validates
 *   type+size, sends it to Gemini audio, and returns a VoiceParseResponse. For
 *   items it matches each against the store's active catalog and creates an
 *   active product for true misses (so they match next time); for a command it
 *   passes the classification back to the client.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *   - Layer 4: resolve a customer (fuzzy, store-scoped) for attach_customer /
 *     customer_balance and return it in the response
 *
 * WHERE IT FITS:
 *   Called by hooks/useVoiceSession.ts once per VAD-finalized segment.
 *
 * CALLED BY / IMPORTS FROM:
 *   hooks/useVoiceSession.ts ; uses lib/anthropic/voiceParse.ts, lib/scan/match.ts,
 *   lib/voice/buildCartRow.ts, lib/ratelimit.ts
 */
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { aiRateLimit } from '@/lib/ratelimit'
import { parseVoiceAudio } from '@/lib/anthropic/voiceParse'
import { matchItem, type CatalogEntry } from '@/lib/scan/match'
import { buildPendingRow } from '@/lib/voice/buildCartRow'
import { matchCustomer, type CustomerEntry } from '@/lib/voice/customer'
import type { VoiceCartRow, VoiceParseResponse, VoiceCustomerMatch } from '@/lib/voice/types'

const ALLOWED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await aiRateLimit(user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many voice requests. Please wait a moment and try again.' },
      { status: 429 },
    )
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('audio') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
  }
  const mime = (file.type || 'audio/webm').split(';')[0].trim()
  if (!ALLOWED_TYPES.includes(mime)) {
    return NextResponse.json({ error: 'Unsupported audio format' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio clip too large' }, { status: 400 })
  }

  const audioBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  let parsed
  try {
    parsed = await parseVoiceAudio(audioBase64, mime)
  } catch {
    return NextResponse.json({ error: 'voice_parse_failed' }, { status: 422 })
  }

  // Command: resolve a customer for udhaar / balance-by-name; else hand back as-is.
  if (parsed.kind === 'command') {
    let customer: VoiceCustomerMatch | null = null
    if (
      (parsed.command === 'attach_customer' || parsed.command === 'customer_balance') &&
      parsed.args.customerName
    ) {
      const customers = await loadCustomers(supabase, store.id)
      customer = matchCustomer(parsed.args.customerName, customers)
    }
    const res: VoiceParseResponse = {
      transcript: parsed.transcript,
      kind: 'command',
      cartItems: [],
      command: parsed.command,
      args: parsed.args,
      customer,
    }
    return NextResponse.json(res)
  }

  // Items: match against the catalog; create active products for true misses.
  const catalog = await loadCatalog(supabase, store.id)
  const cartItems: VoiceCartRow[] = []
  for (const spoken of parsed.items) {
    const sizeToken = spoken.unit && /\d/.test(spoken.unit) ? spoken.unit : null
    const match = matchItem({ normalizedName: spoken.name, sizeToken }, catalog)
    const pending = buildPendingRow(spoken, match)

    let productId = pending.productId
    let unitPrice = pending.unitPrice
    if (!productId) {
      const { data: created } = await supabase
        .from('products')
        .insert({
          store_id: store.id,
          name: pending.name,
          category: 'Uncategorised',
          unit: 'piece',
          purchase_price: 0,
          selling_price: 0,
          tax_rate: 0,
          is_active: true,
          is_pinned: false,
        })
        .select('id')
        .single()
      if (!created) continue // could not create - skip this item rather than 500
      productId = created.id
      unitPrice = 0
    }

    cartItems.push({
      productId: productId!,
      name: pending.name,
      quantity: pending.quantity,
      unitPrice,
      addedAsNew: pending.addAsNew,
    })
  }

  const res: VoiceParseResponse = {
    transcript: parsed.transcript,
    kind: 'items',
    cartItems,
    command: null,
    args: parsed.args,
  }
  return NextResponse.json(res)
}

// Active catalog + 30-day purchase frequency, priced from selling_price
// (voice logs sales). Mirrors lib/scan/resolve.ts without coupling to it.
async function loadCatalog(supabase: SupabaseClient, storeId: string): Promise<CatalogEntry[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, parent_product_id, selling_price')
    .eq('store_id', storeId)
    .eq('is_active', true)

  const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('store_id', storeId)
    .gte('date', since)
  const txIds = (recentTx ?? []).map((t: { id: string }) => t.id)

  const freq: Record<string, number> = {}
  if (txIds.length > 0) {
    const { data: lineItems } = await supabase
      .from('transaction_items')
      .select('product_id')
      .in('transaction_id', txIds)
    for (const li of lineItems ?? []) freq[li.product_id] = (freq[li.product_id] ?? 0) + 1
  }

  return (products ?? []).map((p: {
    id: string; name: string; brand: string | null
    parent_product_id: string | null; selling_price: number
  }) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    parentId: p.parent_product_id ?? null,
    unitPrice: Number(p.selling_price) || 0,
    freq: freq[p.id] ?? 0,
  }))
}

// Store customers (id, name, balance) for fuzzy name matching. Store-scoped,
// named columns, snake_case normalized at the boundary.
async function loadCustomers(supabase: SupabaseClient, storeId: string): Promise<CustomerEntry[]> {
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, current_balance')
    .eq('store_id', storeId)
  return (customers ?? []).map((c: { id: string; name: string; current_balance: number }) => ({
    id: c.id,
    name: c.name,
    currentBalance: Number(c.current_balance) || 0,
  }))
}
