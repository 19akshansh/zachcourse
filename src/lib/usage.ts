/**
 * ZachCourse Try-Then-Commit Usage tracking helpers
 */

// Reads a cookie value by name
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

// Sets a cookie value
function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export function getStarBonusRemaining(): number {
  const val = getCookie("zc_star_bonus");
  return val ? parseInt(val, 10) || 0 : 0;
}

export function setStarBonusRemaining(count: number) {
  setCookie("zc_star_bonus", count.toString());
  // Dispatch an event to update any listening UI
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("zc-key-status-changed"));
  }
}

export function decrementStarBonus(): number {
  const current = getStarBonusRemaining();
  const nextVal = Math.max(0, current - 1);
  setStarBonusRemaining(nextVal);
  return nextVal;
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
