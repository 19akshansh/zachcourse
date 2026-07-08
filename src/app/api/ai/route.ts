import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, systemPrompt } = body;

    const apiKey = req.headers.get("x-user-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API key" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
      system: systemPrompt || undefined,
    });

    const reply = text || "";
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to process request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
