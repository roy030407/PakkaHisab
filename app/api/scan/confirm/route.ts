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
  vendorName?: string
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

  // Create transaction
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      user_id: user.id,
      date: body.date ?? new Date().toISOString().split('T')[0],
      type: 'purchase',
      total_amount: body.totalAmount,
      vendor_name: body.vendorName ?? null,
      payment_method: 'cash',
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

  // Process each item
  for (const item of body.items) {
    // Only use matchedProductId if it was verified as belonging to this store
    let productId = (item.matchedProductId && verifiedProductIds.has(item.matchedProductId))
      ? item.matchedProductId
      : null

    // Create a product ONLY when the merchant explicitly chose "Add as new"
    // (or there is genuinely no verified match to attach to).
    if (item.addAsNew || !productId) {
      const { data: newProduct } = await supabase
        .from('products')
        .insert({
          store_id: store.id,
          name: item.productNameRaw,
          category: 'Uncategorised',
          unit: 'piece',
          purchase_price: item.unitPrice,
          selling_price: item.unitPrice,
          tax_rate: item.taxRate ?? 0,
          is_active: false,
          is_pinned: false,
        })
        .select('id')
        .single()

      if (newProduct) productId = newProduct.id
    }

    if (!productId) continue

    // Insert transaction item
    const { error: itemError } = await supabase.from('transaction_items').insert({
      transaction_id: tx.id,
      product_id: productId,
      product_name_raw: item.productNameRaw,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      tax_rate: item.taxRate ?? 0,
      is_confirmed: true,
    })
    if (itemError) {
      console.error('[scan/confirm] transaction_item insert failed:', itemError.message, { transactionId: tx.id, productId })
      continue // don't update stock for a line that wasn't recorded
    }

    // Update inventory
    await updateStock(supabase, {
      storeId: store.id,
      productId,
      delta: item.quantity,
      transactionId: tx.id,
      movementType: 'purchase',
      unitPrice: item.unitPrice,
    })

    // Learn from a match override: store raw bill text -> chosen product name
    // so the extraction few-shot improves for this store over time.
    if (item.correction && item.correction.original.trim() &&
        item.correction.original.trim() !== item.correction.corrected.trim()) {
      await supabase.from('extraction_corrections').insert({
        store_id: store.id,
        document_upload_id: sourceDocumentId,
        field_name: 'product_name',
        original_value: item.correction.original.trim(),
        corrected_value: item.correction.corrected.trim(),
      })
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
