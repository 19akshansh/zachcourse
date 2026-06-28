import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Simple in-memory Map for IP rate limiting (max 3 requests per minute per IP)
const ipLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const limitInfo = ipLimitMap.get(ip);

  if (!limitInfo || now > limitInfo.resetTime) {
    ipLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (limitInfo.count >= 3) {
    return true;
  }

  limitInfo.count += 1;
  return false;
}

export async function POST(req: Request) {
  // Extract client IP for abuse protection
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ 
        error: "TOO_MANY_REQUESTS", 
        message: "Rate limit exceeded. Max 3 requests per minute." 
      }), 
      {
        status: 429,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const cookieHeader = req.headers.get("cookie") || "";
    
    // Parse cookies for guest queries & star bonus
    const guestMatch = cookieHeader.match(/(?:^|; )zc_guest_queries=([^;]*)/);
    const guestQueries = guestMatch ? parseInt(guestMatch[1], 10) || 0 : 0;

    const starMatch = cookieHeader.match(/(?:^|; )zc_star_bonus=([^;]*)/);
    const starBonus = starMatch ? parseInt(starMatch[1], 10) || 0 : 0;

    // Reject if guest quota exceeded (unless they have star bonus)
    if (starBonus <= 0 && guestQueries >= 1) {
      return new Response(JSON.stringify({ error: "QUOTA_EXCEEDED" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { prompt, systemPrompt } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Call Gemini using server key (process.env.GEMINI_API_KEY)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: "SERVER_CONFIGURATION_ERROR", 
          message: "Gemini API key is not configured on the server." 
        }), 
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const { text } = await generateText({
      model: google("gemini-3.5-flash"),
      prompt,
      system: systemPrompt || undefined,
    });

    const reply = text || "";
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error in server-side AI proxy route:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to process request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
