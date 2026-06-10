/**
 * FILE: app/api/ai/chat/route.ts
 *
 * WHAT THIS DOES:
 *   POST: Streams a Claude response to the merchant's question.
 *   Builds full business context, calls claude-sonnet-4-20250514 with
 *   streaming, and saves the conversation to ai_conversations.
 *   Returns a Server-Sent Events stream.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *
 * WHERE IT FITS:
 *   Called by components/ai/ChatInterface.tsx via fetch with ReadableStream.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/ai/ChatInterface.tsx
 */

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { buildBusinessContext, buildSystemPrompt } from "@/lib/anthropic/advisor"
import { ADVISOR_SYSTEM_PROMPT } from "@/lib/anthropic/prompts"
import { getAnthropicClient } from "@/lib/anthropic/client"
import { aiRateLimit } from "@/lib/ratelimit"

export const runtime = "nodejs"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit — 20 AI requests per minute per user
  const rl = await aiRateLimit(user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    )
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, type, owner_name, preferred_language")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  let body: { messages: ChatMessage[]; conversationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { messages, conversationId } = body
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 })
  }

  const profile = {
    storeId: store.id,
    storeName: store.name,
    storeType: store.type,
    ownerName: store.owner_name,
    preferredLanguage: store.preferred_language ?? "en",
  }

  const context = await buildBusinessContext(supabase, profile)
  const systemPrompt = buildSystemPrompt(ADVISOR_SYSTEM_PROMPT, profile, context)

  const anthropic = getAnthropicClient()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ""
      try {
        const anthropicStream = await anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text
            fullText += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        controller.close()

        // Save conversation
        const updatedMessages = [
          ...messages,
          { role: "assistant" as const, content: fullText },
        ]

        if (conversationId) {
          await supabase
            .from("ai_conversations")
            .update({ messages: updatedMessages })
            .eq("id", conversationId)
            .eq("store_id", store.id)
        } else {
          await supabase.from("ai_conversations").insert({
            store_id: store.id,
            messages: updatedMessages,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI error"
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
