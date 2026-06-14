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
 *
 * WHERE IT FITS:
 *   Route /scan. Accessible from BottomNav.
 *
 * CALLED BY / IMPORTS FROM:
 *   BottomNav, direct navigation
 */
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScanUpload } from '@/components/scan/ScanUpload'
import { ScanLoading } from '@/components/scan/ScanLoading'
import { ExtractionReview } from '@/components/scan/ExtractionReview'
import { LedgerReview } from '@/components/scan/LedgerReview'
import type { ExtractionResult } from '@/types'

type ScanState = 'upload' | 'loading' | 'review' | 'error'

interface ReviewData {
  extraction: ExtractionResult
  documentUploadId: string
  duplicateWarning?: { date: string; id: string } | null
}

interface ConfirmPayload {
  documentUploadId: string
  vendorName?: string
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

  async function handleFileSelected(file: File) {
    setState('loading')
    try {
      // Dynamic import to avoid SSR issues with browser-image-compression
      const imageCompression = (await import('browser-image-compression')).default
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
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
      router.push('/dashboard')
      router.refresh()
    } else {
      const data = await res.json()
      setErrorMessage(data.error ?? 'Failed to save. Please try again.')
      setState('error')
    }
  }

  if (state === 'upload') {
    return <ScanUpload onFileSelected={handleFileSelected} />
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
          onClick={() => setState('upload')}
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
      />
    )
  }

  return null
}
