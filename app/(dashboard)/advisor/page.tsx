/**
 * FILE: app/(dashboard)/advisor/page.tsx
 *
 * WHAT THIS DOES:
 *   The AI Advisor chat page. Full-screen conversation interface with
 *   streaming responses from Claude, pre-loaded with the merchant's
 *   last 90 days of business data as context.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Accessible from dashboard InsightCard "Ask your advisor" link
 *   and bottom navigation.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout, InsightCard link, navigation
 */

import { ChatInterface } from "@/components/ai/ChatInterface"

export default function AdvisorPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 border-b border-gray-100">
        <h1 className="text-base font-semibold text-gray-900">✨ Your business advisor</h1>
        <p className="text-xs text-gray-400 mt-0.5">Knows your store, answers in seconds</p>
      </div>
      <ChatInterface />
    </div>
  )
}
