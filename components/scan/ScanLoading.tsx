/**
 * FILE: components/scan/ScanLoading.tsx
 *
 * WHAT THIS DOES:
 *   Full-screen loading state shown during the synchronous extraction pipeline.
 *   Cycles through status messages to give the user feedback.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Shown when scan state = 'loading', between upload and confirm screens.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/scan/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'

const MESSAGES = [
  'Uploading your bill...',
  'Reading your bill...',
  'Finding your products...',
]

export function ScanLoading() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx(prev => (prev + 1) % MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-slate-700 mb-6" />
      <p className="text-base font-medium text-gray-700 transition-all">{MESSAGES[idx]}</p>
      <p className="text-sm text-gray-400 mt-2">This takes 5–15 seconds</p>
    </div>
  )
}
