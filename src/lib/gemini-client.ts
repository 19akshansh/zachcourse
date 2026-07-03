import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, generateObject } from "ai"
import { 
  getStarBonusRemaining, 
  decrementStarBonus 
} from "./usage"
import { apiFetch } from "./api"
import { z } from "zod"

export function hasUserKey(): boolean {
  return !!(
    typeof window !== "undefined" && 
    localStorage.getItem("zc_user_key")
  )
}

export async function callGemini<T = any>(
  prompt: string, 
  systemPrompt?: string,
  options?: { schema?: z.ZodType<T> }
): Promise<string | T> {
  const isServer = typeof window === "undefined"

  if (isServer) {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error("GEMINI_API_KEY not configured on server")
    const google = createGoogleGenerativeAI({ apiKey: key })
    const model = google("gemini-2.5-flash")

    if (options?.schema) {
      const { object } = await generateObject({
        model,
        system: systemPrompt,
        messages: [{ role: 'user' as const, content: prompt }],
        schema: options.schema as any,
      } as any)
      return object as any
    } else {
      const { text } = await generateText({
        model,
        system: systemPrompt,
        messages: [{ role: 'user' as const, content: prompt }],
      })
      if (!text) throw new Error("Empty response from Gemini")
      return text
    }
  }

  const userKey = localStorage.getItem("zc_user_key")

  if (userKey) {
    try {
      const google = createGoogleGenerativeAI({ 
        apiKey: userKey 
      })
      const model = google("gemini-2.5-flash")
      
      if (options?.schema) {
        const { object } = await generateObject({
          model,
          system: systemPrompt,
          messages: [{ role: 'user' as const, content: prompt }],
          schema: options.schema as any,
        } as any)
        return object as any
      } else {
        const { text } = await generateText({
          model,
          system: systemPrompt,
          messages: [{ role: 'user' as const, content: prompt }],
        })
        
        if (!text) throw new Error("Empty response from Gemini")
        return text
      }
      
    } catch (err: any) {
      console.error("[callGemini] user key error:", err)
      if (err?.message?.includes("429") || 
          err?.message?.includes("quota")) {
        throw new Error(
          "Your Gemini API key has hit its rate limit. " +
          "Wait a minute and try again, or check your " +
          "quota at aistudio.google.com"
        )
      }
      throw err
    }
  }

  if (options?.schema) {
    throw new Error("Structured output with proxy not supported on client without user key")
  }

  // No user key — use server proxy with quota check
  const starBonus = getStarBonusRemaining()

  const response = await apiFetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, systemPrompt }),
  })

  if (!response.ok) {
    const msg = await response.text()
    throw new Error(msg || "Server AI call failed")
  }

  const data = await response.json()

  // Update quota counters
  if (starBonus > 0) decrementStarBonus()

  return data.reply
}
