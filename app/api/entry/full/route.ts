/**
 * FILE: app/api/entry/full/route.ts
 *
 * WHAT THIS DOES:
 *   Full-form transaction save. Client provides explicit unitPrice and date.
 *   Otherwise identical to quick route in structure.
 *   Updates customer.current_balance for credit sales.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Security: reject items with product IDs not belonging to the store
 *   - Security: try/catch on request.json()
 *
 * WHERE IT FITS:
 *   Called by FullEntryForm on save.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/entry/FullEntryForm.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateStock } from '@/lib/inventory/updateStock'
import type { FullEntryPayload } from '@/types'

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: FullEntryPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.items?.length) return NextResponse.json({ error: 'No items provided' }, { status: 400 })

  const { data: products } = await supabase
    .from('products')
    .select('id, name, tax_rate')
    .in('id', body.items.map(i => i.productId))
    .eq('store_id', store.id)

  const pm = new Map((products ?? []).map((p: { id: string; name: string; tax_rate: number }) => [p.id, p]))

  let enriched: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
    taxRate: number
  }>

  try {
    enriched = body.items.map(item => {
      const p = pm.get(item.productId)
      if (!p) throw new Error('product_not_found')
      return {
        productId: item.productId,
        productName: p.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        taxRate: Number(p.tax_rate),
      }
    })
  } catch {
    return NextResponse.json({ error: 'One or more products not found in your store' }, { status: 400 })
  }

  const totalAmount = enriched.reduce((s, i) => s + i.totalPrice, 0)

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      user_id: user.id,
      date: body.date,
      type: body.type,
      total_amount: totalAmount,
      customer_id: body.customerId ?? null,
      vendor_name: body.vendorName ?? null,
      payment_method: body.paymentMethod,
      source: 'manual_full',
      tax_amount: 0,
      notes: body.notes ?? null,
    })
    .select('id')
    .single()

  if (txError || !tx) return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 })

  for (const item of enriched) {
    await supabase.from('transaction_items').insert({
      transaction_id: tx.id,
      product_id: item.productId,
      product_name_raw: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      tax_rate: item.taxRate,
      is_confirmed: true,
    })

    // Only write stock movements for sale and purchase — not expense/income
    if (body.type === 'sale' || body.type === 'purchase') {
      const delta = body.type === 'sale' ? -item.quantity : item.quantity
      await updateStock(supabase, {
        storeId: store.id,
        productId: item.productId,
        delta,
        transactionId: tx.id,
        movementType: body.type,
        unitPrice: item.unitPrice,
      })
    }
  }

  // Credit sale: increment customer balance
  if (body.customerId && body.paymentMethod === 'credit' && body.type === 'sale') {
    const { data: customer } = await supabase
      .from('customers')
      .select('current_balance')
      .eq('id', body.customerId)
      .eq('store_id', store.id)
      .single()

    if (customer) {
      await supabase
        .from('customers')
        .update({ current_balance: Number(customer.current_balance) + totalAmount })
        .eq('id', body.customerId)
    }
  }

  return NextResponse.json({ transactionId: tx.id }, { status: 201 })
}
