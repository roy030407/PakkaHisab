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

  // Reverse a credit sale's effect on the customer balance.
  const balanceDelta = balanceReversalAmount({
    type: tx.type as TransactionType,
    paymentMethod: tx.payment_method,
    customerId: tx.customer_id,
    totalAmount: Number(tx.total_amount),
  })
  if (balanceDelta > 0 && tx.customer_id) {
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
