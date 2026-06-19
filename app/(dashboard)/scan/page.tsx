/**
 * FILE: app/(dashboard)/scan/page.tsx
 *
 * WHAT THIS DOES:
 *   Bill scan page. Manages 4 states: upload → loading → review → error.
 *   Compresses image client-side, POSTs to /api/scan, then shows confirm screen.
 *   On save: POSTs to /api/scan/confirm and redirects to /dashboard.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *   - Slice B2: after a scanned SALE, offer a WhatsApp receipt share
 *
 * WHERE IT FITS:
 *   Route /scan. Accessible from BottomNav.
 *
 * CALLED BY / IMPORTS FROM:
 *   BottomNav, direct navigation
 */
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScanUpload } from '@/components/scan/ScanUpload'
import { ScanLoading } from '@/components/scan/ScanLoading'
import { ExtractionReview } from '@/components/scan/ExtractionReview'
import { LedgerReview } from '@/components/scan/LedgerReview'
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'
import type { ExtractionResult } from '@/types'

type ScanState = 'upload' | 'loading' | 'review' | 'error'

interface ReviewData {
  extraction: ExtractionResult
  documentUploadId: string
  duplicateWarning?: { date: string; id: string } | null
}

interface ConfirmPayload {
  documentUploadId: string
  type?: 'purchase' | 'sale'
  vendorName?: string
  customerId?: string
  paymentMethod?: 'cash' | 'upi' | 'credit'
  date?: string
  totalAmount: number
  items: Array<{
    productNameRaw: string
    matchedProductId?: string
    addAsNew: boolean
    quantity: number
    unitPrice: number
    totalPrice: number
    taxRate?: number
    correction?: { original: string; corrected: string }
  }>
}

export default function ScanPage() {
  const router = useRouter()
  const [state, setState] = useState<ScanState>('upload')
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [shopName, setShopName] = useState('')
  const [savedSale, setSavedSale] = useState<{ id: string; total: number } | null>(null)
  // Batch: a queue of gallery photos, reviewed/saved one at a time.
  const [queue, setQueue] = useState<File[]>([])
  const [queuePos, setQueuePos] = useState(0)

  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setShopName(d.store?.name ?? '')).catch(() => {})
  }, [])

  function handleFilesSelected(files: File[]) {
    if (files.length === 0) return
    setQueue(files)
    setQueuePos(0)
    processFile(files[0])
  }

  async function processFile(file: File) {
    setState('loading')
    try {
      // Dynamic import to avoid SSR issues with browser-image-compression
      const imageCompression = (await import('browser-image-compression')).default
      const compressed = await imageCompression(file, {
        // Smaller upload = faster on patchy 4G. 1280px is still legible for
        // bill text; Gemini reads it fine.
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      })

      const formData = new FormData()
      formData.append('file', compressed, file.name)

      const res = await fetch('/api/scan', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }

      setReviewData({
        extraction: data.extraction,
        documentUploadId: data.documentUploadId,
        duplicateWarning: data.duplicateWarning ?? null,
      })
      setState('review')
    } catch {
      setErrorMessage('Could not process the image. Please try again.')
      setState('error')
    }
  }

  async function handleSave(payload: ConfirmPayload) {
    const res = await fetch('/api/scan/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      // In a batch, advance to the next photo instead of leaving the flow.
      if (queuePos + 1 < queue.length) {
        const next = queuePos + 1
        setQueuePos(next)
        setReviewData(null)
        processFile(queue[next])
        return
      }
      // Single sale: offer the WhatsApp receipt. (Skipped during a batch.)
      if (queue.length <= 1 && payload.type === 'sale' && data?.transactionId) {
        setSavedSale({ id: data.transactionId, total: payload.totalAmount })
        return
      }
      setQueue([])
      setQueuePos(0)
      router.push('/dashboard')
      router.refresh()
    } else {
      const data = await res.json()
      setErrorMessage(data.error ?? 'Failed to save. Please try again.')
      setState('error')
    }
  }

  // Discard the current bill: in a batch, skip to the next; otherwise go back.
  function skipOrBack() {
    setReviewData(null)
    if (queuePos + 1 < queue.length) {
      const next = queuePos + 1
      setQueuePos(next)
      processFile(queue[next])
    } else {
      setQueue([])
      setQueuePos(0)
      setState('upload')
    }
  }

  if (savedSale) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
          &#10003;
        </div>
        <p className="text-lg font-semibold text-gray-900">Sale saved</p>
        <p className="mt-1 text-sm text-gray-500">
          &#8377;{savedSale.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          <ShareReceiptButton transactionId={savedSale.id} shopName={shopName} variant="prominent" />
          <button
            onClick={() => { router.push('/dashboard'); router.refresh() }}
            className="btn-lift w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  if (state === 'upload') {
    return <ScanUpload onFileSelected={handleFilesSelected} />
  }

  if (state === 'loading') {
    return <ScanLoading />
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <p className="text-base font-semibold text-red-700 mb-2">Something went wrong</p>
        <p className="text-sm text-gray-500 mb-6">{errorMessage}</p>
        <button
          onClick={() => { setQueue([]); setQueuePos(0); setState('upload') }}
          className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium"
        >
          Try again
        </button>
      </div>
    )
  }

  if (state === 'review' && reviewData) {
    if (reviewData.extraction.documentType === 'ledger_page') {
      return (
        <LedgerReview
          extraction={reviewData.extraction}
          documentUploadId={reviewData.documentUploadId}
          onSave={handleSave}
        />
      )
    }
    return (
      <ExtractionReview
        extraction={reviewData.extraction}
        documentUploadId={reviewData.documentUploadId}
        duplicateWarning={reviewData.duplicateWarning}
        onSave={handleSave}
        onCancel={skipOrBack}
        batchLabel={queue.length > 1 ? `Bill ${queuePos + 1} of ${queue.length}` : undefined}
      />
    )
  }

  return null
}
