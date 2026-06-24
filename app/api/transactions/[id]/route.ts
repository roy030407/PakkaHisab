/**
 * FILE: app/api/transactions/[id]/route.ts
 *
 * WHAT THIS DOES:
 *   DELETE - removes a saved transaction and reverses its side effects:
 *   restores inventory (a sale put goods out, a purchase brought goods in),
 *   reverses a credit sale's customer balance, and deletes the transaction's
 *   stock_movements and transaction_items before the transaction itself.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (delete a wrongly-saved transaction from the ledger)
 *   - Reverse 'payment' rows on delete (re-adds the amount to the balance)
 *   - GET returns a transaction + its items + customer (for receipt sharing)
 *   - PATCH void endpoint: soft-deletes via voided_at, reverses inventory + balance
 *
 * WHERE IT FITS:
 *   Called by components/customers/CustomerLedger.tsx (delete control per row).
 *
 * CALLED BY / IMPORTS FROM:
 *   components/customers/CustomerLedger.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { inventoryReversals, balanceReversalAmount } from '@/lib/transactions/reverse'
import type { TransactionType } from '@/types'

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Load the transaction, scoped to this store (ownership check).
  const { data: tx } = await supabase
    .from('transactions')
    .select('id, type, total_amount, customer_id, payment_method')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!tx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  // Reverse inventory using the line items (sale put stock out, purchase brought it in).
  const { data: lineItems } = await supabase
    .from('transaction_items')
    .select('product_id, quantity')
    .eq('transaction_id', tx.id)

  const reversals = inventoryReversals(
    tx.type as TransactionType,
    (lineItems ?? []).map(li => ({ productId: li.product_id, quantity: Number(li.quantity) }))
  )
  for (const r of reversals) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, current_stock')
      .eq('store_id', store.id)
      .eq('product_id', r.productId)
      .maybeSingle()
    if (inv) {
      await supabase
        .from('inventory')
        .update({
          current_stock: Number(inv.current_stock) + r.delta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inv.id)
    }
  }

  // Undo this transaction's effect on the customer balance. A credit sale gave a
  // positive reversal (subtract); a payment gives a negative reversal (re-add).
  const balanceDelta = balanceReversalAmount({
    type: tx.type as TransactionType,
    paymentMethod: tx.payment_method,
    customerId: tx.customer_id,
    totalAmount: Number(tx.total_amount),
  })
  if (balanceDelta !== 0 && tx.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('current_balance')
      .eq('id', tx.customer_id)
      .eq('store_id', store.id)
      .maybeSingle()
    if (customer) {
      await supabase
        .from('customers')
        .update({ current_balance: Number(customer.current_balance) - balanceDelta })
        .eq('id', tx.customer_id)
        .eq('store_id', store.id)
    }
  }

  // Delete children first (avoids FK violations regardless of cascade config),
  // then the transaction itself.
  await supabase.from('stock_movements').delete().eq('transaction_id', tx.id).eq('store_id', store.id)
  await supabase.from('transaction_items').delete().eq('transaction_id', tx.id)
  const { error: delError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', tx.id)
    .eq('store_id', store.id)

  if (delError) {
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: transaction } = await supabase
    .from('transactions')
    .select('id, date, type, total_amount, payment_method, customer_id, vendor_name')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!transaction) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('transaction_items')
    .select('product_name_raw, quantity, unit_price, total_price')
    .eq('transaction_id', transaction.id)

  let customer: { name: string; phone: string | null; current_balance: number } | null = null
  if (transaction.customer_id) {
    const { data: c } = await supabase
      .from('customers')
      .select('name, phone, current_balance')
      .eq('id', transaction.customer_id)
      .eq('store_id', store.id)
      .maybeSingle()
    customer = c ?? null
  }

  return NextResponse.json({ transaction, items: items ?? [], customer })
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: string; paymentMethod?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.action === 'set_payment') {
    const pm = body.paymentMethod
    if (pm !== 'cash' && pm !== 'upi' && pm !== 'credit') {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }
    const { data: store2 } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    if (!store2) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { error: pmErr } = await supabase
      .from('transactions')
      .update({ payment_method: pm })
      .eq('id', params.id)
      .eq('store_id', store2.id)
    if (pmErr) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ updated: true })
  }

  if (body.action !== 'void') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: tx } = await supabase
    .from('transactions')
    .select('id, type, total_amount, customer_id, payment_method, voided_at')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (tx.voided_at) return NextResponse.json({ error: 'Already voided' }, { status: 409 })

  // Reverse inventory
  const { data: lineItems } = await supabase
    .from('transaction_items')
    .select('product_id, quantity')
    .eq('transaction_id', tx.id)

  const reversals = inventoryReversals(
    tx.type as TransactionType,
    (lineItems ?? []).map((li: { product_id: string; quantity: number }) => ({
      productId: li.product_id,
      quantity: Number(li.quantity),
    }))
  )
  for (const r of reversals) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, current_stock')
      .eq('store_id', store.id)
      .eq('product_id', r.productId)
      .maybeSingle()
    if (inv) {
      await supabase
        .from('inventory')
        .update({
          current_stock: Number(inv.current_stock) + r.delta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inv.id)
    }
  }

  // Reverse customer balance
  const balanceDelta = balanceReversalAmount({
    type: tx.type as TransactionType,
    paymentMethod: tx.payment_method,
    customerId: tx.customer_id,
    totalAmount: Number(tx.total_amount),
  })
  if (balanceDelta !== 0 && tx.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('current_balance')
      .eq('id', tx.customer_id)
      .eq('store_id', store.id)
      .maybeSingle()
    if (customer) {
      await supabase
        .from('customers')
        .update({ current_balance: Number(customer.current_balance) - balanceDelta })
        .eq('id', tx.customer_id)
        .eq('store_id', store.id)
    }
  }

  // Set voided_at (soft delete)
  const { error: voidError } = await supabase
    .from('transactions')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', tx.id)
    .eq('store_id', store.id)

  if (voidError) return NextResponse.json({ error: 'Failed to void transaction' }, { status: 500 })

  return NextResponse.json({ voided: true })
}
