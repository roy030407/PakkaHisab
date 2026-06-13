/**
 * FILE: app/api/scan/route.ts
 *
 * WHAT THIS DOES:
 *   POST: Receives a bill image, validates MIME+size, uploads to Supabase Storage,
 *   calls Claude Vision extraction, runs duplicate detection, returns ExtractionResult.
 *   Synchronous - client waits for the full pipeline before receiving a response.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   First step of the scan flow. Called by ScanUpload component after
 *   client-side compression.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/scan/ScanUpload.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { extractBillData } from '@/lib/anthropic/extraction'
import { scanRateLimit } from '@/lib/ratelimit'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit - 10 scans per minute per user
  const rl = await scanRateLimit(user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many scan requests. Please wait a moment and try again.' },
      { status: 429 }
    )
  }

  // Get store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Parse multipart form
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // MIME validation (server-side, not trusting client)
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Accepted: JPEG, PNG, WebP, PDF.' },
      { status: 400 }
    )
  }

  // Size validation
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10MB.' },
      { status: 400 }
    )
  }

  // Build storage path
  const ext = file.type === 'application/pdf' ? 'pdf'
    : file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : 'jpg'
  const uuid = randomUUID()
  const storagePath = `${user.id}/${uuid}.${ext}`

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Create document_uploads row with status pending
  const { data: docUpload, error: docError } = await supabase
    .from('document_uploads')
    .insert({
      store_id: store.id,
      user_id: user.id,
      storage_path: storagePath,
      file_type: file.type,
      document_type: 'single_bill',
      extraction_status: 'pending',
    })
    .select('id')
    .single()

  if (docError || !docUpload) {
    // Clean up the orphaned storage object so quota isn't wasted
    await supabase.storage.from('documents').remove([storagePath])
    return NextResponse.json({ error: 'Failed to record upload' }, { status: 500 })
  }

  // Call Claude Vision extraction
  let extraction
  try {
    const imageBase64 = buffer.toString('base64')
    extraction = await extractBillData(supabase, store.id, imageBase64, file.type)
  } catch {
    await supabase
      .from('document_uploads')
      .update({ extraction_status: 'failed' })
      .eq('id', docUpload.id)
    return NextResponse.json({ error: 'extraction_failed' }, { status: 422 })
  }

  // Duplicate detection: same vendor + total within 24h
  let duplicateWarning: { date: string; id: string } | null = null
  if (extraction.vendorName && extraction.totalAmount != null) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('store_id', store.id)
      .eq('vendor_name', extraction.vendorName)
      .eq('total_amount', extraction.totalAmount)
      .gte('created_at', oneDayAgo)
      .limit(1)
      .maybeSingle()

    if (existing) {
      duplicateWarning = { date: existing.created_at, id: existing.id }
    }
  }

  // Update document_uploads row to extracted
  await supabase
    .from('document_uploads')
    .update({
      extraction_status: 'extracted',
      raw_extraction_json: extraction as unknown as Record<string, unknown>,
      confidence: extraction.confidence,
    })
    .eq('id', docUpload.id)

  return NextResponse.json({
    documentUploadId: docUpload.id,
    extraction,
    duplicateWarning,
  })
}
