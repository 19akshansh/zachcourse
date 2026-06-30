import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import { 
  getStarBonusRemaining, 
  decrementStarBonus 
} from "./usage"
import { apiFetch } from "./api"

export function hasUserKey(): boolean {
  return !!(
    typeof window !== "undefined" && 
    localStorage.getItem("zc_user_key")
  )
}

export async function callGemini(
  prompt: string, 
  systemPrompt?: string
): Promise<string> {
  const userKey = typeof window !== "undefined" 
    ? localStorage.getItem("zc_user_key") 
    : null

  if (userKey) {
    try {
      // Create a client with the user's own key
      const google = createGoogleGenerativeAI({ 
        apiKey: userKey 
      })
      
      const { text } = await generateText({
        model: google("gemini-2.5-flash"),
        system: systemPrompt || undefined,
        prompt,
      })
      
      if (!text) throw new Error("Empty response from Gemini")
      return text
      
    } catch (err: any) {
      console.error("[callGemini] user key error:", err)
      // If quota exceeded on user's key, tell them clearly
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
