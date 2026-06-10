/**
 * FILE: app/(dashboard)/entry/page.tsx
 *
 * WHAT THIS DOES:
 *   Wraps QuickEntry and FullEntryForm. Defaults to quick mode.
 *   ?mode=full query param opens full mode directly.
 *   Items carry over when switching between modes.
 *   On save: redirects to /dashboard.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Route /entry. Accessible from BottomNav.
 *
 * CALLED BY / IMPORTS FROM:
 *   BottomNav, scan page "Edit all details" link
 */
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QuickEntry } from '@/components/entry/QuickEntry'
import { FullEntryForm } from '@/components/entry/FullEntryForm'

interface LineItem { productId: string; productName: string; unitPrice: number; quantity: number }

export default function EntryPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<'quick' | 'full'>(
    params.get('mode') === 'full' ? 'full' : 'quick'
  )
  const [transferItems, setTransferItems] = useState<LineItem[]>([])

  function handleSaved() {
    router.push('/dashboard')
    router.refresh()
  }

  function switchToFull(items: LineItem[]) {
    setTransferItems(items)
    setMode('full')
  }

  function switchToQuick() {
    setTransferItems([])
    setMode('quick')
  }

  if (mode === 'full') {
    return <FullEntryForm initialItems={transferItems} onSaved={handleSaved} onSwitchQuick={switchToQuick} />
  }
  return <QuickEntry onSaved={handleSaved} onSwitchFull={switchToFull} />
}
