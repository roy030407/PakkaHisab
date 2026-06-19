/**
 * FILE: app/api/scan/confirm/route.ts
 *
 * WHAT THIS DOES:
 *   Saves a confirmed bill extraction as a transaction.
 *   Creates: 1 transaction row, N transaction_items, N stock_movements,
 *   upserts inventory, stores field corrections, marks document_upload confirmed.
 *   For unmatched items: creates placeholder products with is_active=false.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Security: verify matchedProductId store ownership before use
 *   - Security: try/catch on request.json()
 *   - Slice B2: can save a scan as a sale (stock out + credit balance), not only a purchase
 *   - Add-as-new products are now created is_active=true so they match the next scan
 *   - Perf: resolve products in parallel, batch-insert items + corrections, and
 *     aggregate stock updates per product (was ~40 sequential awaits per bill)
 *
 * WHERE IT FITS:
 *   Called by ExtractionReview "Save" button after merchant confirms items.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/scan/ExtractionReview.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateStock } from '@/lib/inventory/updateStock'

interface ConfirmItem {
  productNameRaw: string
  matchedProductId?: string
  addAsNew: boolean
  quantity: number
  unitPrice: number
  totalPrice: number
  taxRate?: number
  // When the merchant's final product differs from what the AI read, this
  // pair is stored so future scans of the same handwriting read better.
  correction?: { original: string; corrected: string }
}

interface ConfirmPayload {
  documentUploadId: string
  type?: 'purchase' | 'sale'
  vendorName?: string
  customerId?: string
  paymentMethod?: 'cash' | 'upi' | 'credit'
  date?: string
  totalAmount: number
  items: ConfirmItem[]
}

export async function POST(request: Request) {
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

  let body: ConfirmPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Defense in depth: only attach the document upload if it belongs to this store.
  let sourceDocumentId: string | null = null
  if (body.documentUploadId) {
    const { data: ownedDoc } = await supabase
      .from('document_uploads')
      .select('id')
      .eq('id', body.documentUploadId)
      .eq('store_id', store.id)
      .maybeSingle()
    sourceDocumentId = ownedDoc ? body.documentUploadId : null
  }

  const isSale = body.type === 'sale'

  // Sale only: verify the customer belongs to this store before attaching it.
  let verifiedCustomerId: string | null = null
  if (isSale && body.customerId) {
    const { data: c } = await supabase
      .from('customers')
      .select('id')
      .eq('id', body.customerId)
      .eq('store_id', store.id)
      .maybeSingle()
    verifiedCustomerId = c ? body.customerId : null
  }

  const paymentMethod = isSale ? (body.paymentMethod ?? 'cash') : 'cash'

  // Create transaction
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      user_id: user.id,
      date: body.date ?? new Date().toISOString().split('T')[0],
      type: isSale ? 'sale' : 'purchase',
      total_amount: body.totalAmount,
      vendor_name: isSale ? null : (body.vendorName ?? null),
      customer_id: verifiedCustomerId,
      payment_method: paymentMethod,
      source: 'bill_scan',
      source_document_id: sourceDocumentId,
      tax_amount: 0,
    })
    .select('id')
    .single()

  if (txError || !tx) {
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }

  // Collect all claimed matched product IDs and verify they belong to this store
  const claimedIds = body.items
    .map(i => i.matchedProductId)
    .filter((id): id is string => !!id)

  const verifiedProductIds = new Set<string>()
  if (claimedIds.length > 0) {
    const { data: owned } = await supabase
      .from('products')
      .select('id')
      .in('id', claimedIds)
      .eq('store_id', store.id)
    for (const p of owned ?? []) verifiedProductIds.add(p.id)
  }

  // Resolve a product id per line in parallel. "Add as new" creates an active
  // product so it matches the next scan. (Was a sequential per-item loop of ~40
  // awaits for a 10-item bill; this batches the work to cut save latency.)
  const storeId = store.id
  async function resolveLine(item: ConfirmItem): Promise<{ item: ConfirmItem; productId: string } | null> {
    let productId = (item.matchedProductId && verifiedProductIds.has(item.matchedProductId))
      ? item.matchedProductId
      : null
    if (item.addAsNew || !productId) {
      const { data: newProduct } = await supabase
        .from('products')
        .insert({
          store_id: storeId,
          name: item.productNameRaw,
          category: 'Uncategorised',
          unit: 'piece',
          purchase_price: item.unitPrice,
          selling_price: item.unitPrice,
          tax_rate: item.taxRate ?? 0,
          is_active: true,
          is_pinned: false,
        })
        .select('id')
        .single()
      productId = newProduct?.id ?? null
    }
    return productId ? { item, productId } : null
  }

  const resolved = (await Promise.all(body.items.map(resolveLine)))
    .filter((r): r is { item: ConfirmItem; productId: string } => r !== null)

  // One batch insert for all transaction items.
  if (resolved.length > 0) {
    const { error: itemsError } = await supabase.from('transaction_items').insert(
      resolved.map(({ item, productId }) => ({
        transaction_id: tx.id,
        product_id: productId,
        product_name_raw: item.productNameRaw,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        tax_rate: item.taxRate ?? 0,
        is_confirmed: true,
      }))
    )
    if (itemsError) {
      console.error('[scan/confirm] transaction_items batch insert failed:', itemsError.message, { transactionId: tx.id })
    }
  }

  // Aggregate the stock movement per product (one update each), in parallel.
  // Sale moves stock out (-qty); purchase brings it in (+qty).
  const stockByProduct = new Map<string, { delta: number; unitPrice: number }>()
  for (const { item, productId } of resolved) {
    const prev = stockByProduct.get(productId)?.delta ?? 0
    stockByProduct.set(productId, {
      delta: prev + (isSale ? -item.quantity : item.quantity),
      unitPrice: item.unitPrice,
    })
  }
  await Promise.all(
    Array.from(stockByProduct.entries()).map(([productId, { delta, unitPrice }]) =>
      updateStock(supabase, {
        storeId,
        productId,
        delta,
        transactionId: tx.id,
        movementType: isSale ? 'sale' : 'purchase',
        unitPrice,
      })
    )
  )

  // One batch insert for the learned corrections (raw bill text -> chosen name).
  const correctionRows = body.items
    .filter(item => item.correction && item.correction.original.trim() &&
      item.correction.original.trim() !== item.correction.corrected.trim())
    .map(item => ({
      store_id: store.id,
      document_upload_id: sourceDocumentId,
      field_name: 'product_name',
      original_value: item.correction!.original.trim(),
      corrected_value: item.correction!.corrected.trim(),
    }))
  if (correctionRows.length > 0) {
    await supabase.from('extraction_corrections').insert(correctionRows)
  }

  // A credit sale increases what the customer owes (mirrors entry/quick).
  if (isSale && verifiedCustomerId && paymentMethod === 'credit') {
    const { data: customer } = await supabase
      .from('customers')
      .select('current_balance')
      .eq('id', verifiedCustomerId)
      .eq('store_id', store.id)
      .single()
    if (customer) {
      await supabase
        .from('customers')
        .update({ current_balance: Number(customer.current_balance) + Number(body.totalAmount) })
        .eq('id', verifiedCustomerId)
        .eq('store_id', store.id)
    }
  }

  // Mark document upload as confirmed
  await supabase
    .from('document_uploads')
    .update({ extraction_status: 'confirmed' })
    .eq('id', body.documentUploadId)
    .eq('store_id', store.id)

  return NextResponse.json({ transactionId: tx.id }, { status: 201 })
}
