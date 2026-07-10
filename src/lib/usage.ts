/**
 * ZachCourse Try-Then-Commit Usage tracking helpers
 */

export function getStarBonusRemaining(): number {
  return 0;
}

export function setStarBonusRemaining(count: number) {
}

export function decrementStarBonus(): number {
  return 0;
}

/**
 * Validates a Gemini API Key client-side
 */
export async function validateUserKey(key: string): Promise<{ valid: boolean, error?: string }> {
  if (!key || key.trim().length < 20) return { valid: false, error: "Key is too short" }
  
  try {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google")
    const { generateText } = await import("ai")
    
    const google = createGoogleGenerativeAI({ apiKey: key.trim() })
    
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: "Say: ok",
      maxOutputTokens: 5,
    })
    
    return { valid: !!text }
    
  } catch (err: any) {
    const status = err?.status || err?.statusCode || err?.response?.status;
    const msg = (err?.message || "").toLowerCase();
    
    // Quota/rate limit (429) or overloaded/resource exhausted = key IS valid but exhausted
    if (status === 429 || msg.includes("quota") || msg.includes("limit") || msg.includes("exhausted") || msg.includes("resource_exhausted")) {
      return { valid: true };
    }
    
    // Invalid API key (usually 400 or 403 with API_KEY_INVALID or key not valid)
    if (status === 403 || (status === 400 && (msg.includes("invalid") || msg.includes("not valid") || msg.includes("api_key_invalid")))) {
      return { valid: false, error: "The API key provided is invalid." };
    }
    
    // General 400 bad request with a valid key (e.g. wrong parameter formatting) is treated as a valid key
    if (status === 400) {
      return { valid: true };
    }
    
    console.error("[validateUserKey] failed:", err);
    return { valid: false, error: err?.message || "Verification failed" };
  }
}
