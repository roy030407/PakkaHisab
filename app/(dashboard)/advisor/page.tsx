/**
 * FILE: app/(dashboard)/advisor/page.tsx
 *
 * WHAT THIS DOES:
 *   The AI Advisor chat page. Shows today's tip as a banner at the top,
 *   with the full chat interface below. "Ask about this tip" sends the
 *   tip into the chat as a question.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *   - Khata Green restyle
 *   - Added TipBanner above chat with "Ask about this tip" wired to send
 *
 * WHERE IT FITS:
 *   Accessible from dashboard InsightCard "Tell me more" link
 *   and sidebar navigation.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout, InsightCard link, navigation
 */

'use client'

import { useRef } from 'react'
import { ChatInterface } from "@/components/ai/ChatInterface"
import { TipBanner } from "@/components/ai/TipBanner"

export default function AdvisorPage() {
  const sendRef = useRef<((text: string) => void) | null>(null)

  function handleAskAboutTip(tip: string) {
    if (sendRef.current) {
      sendRef.current(`You mentioned: "${tip}"\n\nTell me more about this. What should I do?`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 border-b border-gray-100">
        <h1 className="text-base font-semibold text-gray-900">Your business advisor</h1>
        <p className="text-xs text-gray-400 mt-0.5">Knows your store, answers in seconds</p>
      </div>
      <TipBanner onAskAboutTip={handleAskAboutTip} />
      <ChatInterface onSendRef={sendRef} />
    </div>
  )
}
