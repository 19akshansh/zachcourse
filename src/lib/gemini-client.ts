import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, generateObject } from "ai"
import { z } from "zod"

export function hasUserKey(): boolean {
  if (typeof window === "undefined") return false;
  const k = localStorage.getItem("zc_user_key");
  return !!k && k !== "null" && k !== "undefined" && k.trim() !== "";
}

export async function callGemini<T = any>(
  prompt: string, 
  systemPrompt?: string,
  options?: { schema?: z.ZodType<T>, apiKey?: string }
): Promise<string | T> {
  const isServer = typeof window === "undefined"
  if (isServer) {
    let key = options?.apiKey
    if (!key || key === "null" || key === "undefined" || key.trim() === "" || key.trim().length < 20) {
      throw new Error("MISSING_API_KEY")
    }
    let trimmed = key.trim()
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    if (trimmed.length < 20) {
      throw new Error("INVALID_API_KEY")
    }
    const google = createGoogleGenerativeAI({ apiKey: trimmed })
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

  let userKey = localStorage.getItem("zc_user_key");
  if (userKey === "null" || userKey === "undefined" || !userKey || userKey.trim() === "") {
    userKey = null;
  }

  if (userKey) {
    const trimmed = userKey.trim();
    if (trimmed.length < 20) {
      throw new Error("INVALID_API_KEY");
    }
    try {
      const google = createGoogleGenerativeAI({ 
        apiKey: trimmed 
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

  throw new Error("Missing API Key. Please provide a valid Gemini API key.");
}
