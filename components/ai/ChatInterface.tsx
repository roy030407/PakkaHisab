/**
 * FILE: components/ai/ChatInterface.tsx
 *
 * WHAT THIS DOES:
 *   Full-screen chat UI. Sends messages to /api/ai/chat and renders
 *   streaming token responses word-by-word via SSE. Maintains local
 *   conversation history for context. Saves conversationId returned
 *   from the first assistant message to thread messages together.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *   - Khata Green restyle
 *   - Fix: render SSE error events (previously ignored, leaving an empty
 *     bubble when the AI call failed) + fallback when stream ends empty
 *
 * WHERE IT FITS:
 *   The only component on app/(dashboard)/advisor/page.tsx.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/advisor/page.tsx
 */

"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

const QUICK_PROMPTS = [
  "Why is cash low this month?",
  "What should I order this week?",
  "Which customer owes the most?",
  "Is this month better than last?",
]

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return

      const userMessage: Message = { role: "user", content: text.trim() }
      const updatedMessages = [...messages, userMessage]
      setMessages([...updatedMessages, { role: "assistant", content: "", streaming: true }])
      setInput("")
      setLoading(true)

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            conversationId,
          }),
        })

        if (!res.ok || !res.body) {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: "Something went wrong. Please try again." },
          ])
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let assistantText = ""
        let streamError: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6).trim()
            if (data === "[DONE]") break
            try {
              const parsed = JSON.parse(data)
              if (parsed.error) {
                streamError = parsed.error
              }
              if (parsed.text) {
                assistantText += parsed.text
                setMessages((prev) => [
                  ...prev.slice(0, -1),
                  { role: "assistant", content: assistantText, streaming: true },
                ])
              }
              if (parsed.conversationId && !conversationId) {
                setConversationId(parsed.conversationId)
              }
            } catch {
              // malformed chunk — skip
            }
          }
        }

        const finalContent =
          assistantText ||
          streamError ||
          "The advisor could not answer right now. Please try again in a moment."
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: finalContent },
        ])
      } catch {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content: "Could not reach the advisor. Check your connection.",
          },
        ])
      } finally {
        setLoading(false)
        inputRef.current?.focus()
      }
    },
    [messages, loading, conversationId]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] max-w-2xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="pt-8">
            <p className="text-center text-sm font-medium text-gray-700 mb-1">
              Ask your business advisor
            </p>
            <p className="text-center text-xs text-gray-400 mb-6">
              Knows your sales, inventory, and customers
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1.5 text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-emerald-700 text-white rounded-2xl rounded-br-md"
                  : "bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-md shadow-sm"
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse rounded-sm align-middle" />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your business…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent max-h-32 overflow-auto"
            style={{ lineHeight: "1.5" }}
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-emerald-800 active:opacity-80 transition-colors"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-400 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
