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
export async function validateUserKey(key: string): Promise<boolean> {
  if (!key || key.trim().length < 20) return false
  
  try {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google")
    const { generateText } = await import("ai")
    
    const google = createGoogleGenerativeAI({ apiKey: key.trim() })
    
    const { text } = await generateText({
      model: google("gemini-3.5-flash"),
      prompt: "Say: ok",
      maxOutputTokens: 5,
    })
    
    return !!text
    
  } catch (err: any) {
    const msg = err?.message || ""
    // Quota/rate limit = key IS valid, just exhausted
    if (msg.includes("429") || msg.includes("quota") || 
        msg.includes("rate")) {
      return true
    }
    // 400 bad request but key accepted = valid key
    if (msg.includes("400")) return true
    
    console.error("[validateUserKey] failed:", msg)
    return false
  }
}
