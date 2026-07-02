import { PDFParse } from "pdf-parse"

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /system\s*prompt/i,
  /disregard\s+all/i,
  /new\s+instructions:/i,
  /forget\s+everything/i,
  /override\s+(your\s+)?instructions/i,
]

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text))
}

export function sanitizeText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")        // strip HTML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")  // control chars
    .replace(/\s{4,}/g, "\n\n")      // normalize whitespace
    .trim()
    .slice(0, 50_000)                // hard cap
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  originalName: string
): Promise<{ text: string; pages?: number; error?: string }> {
  try {
    if (mimetype === "application/pdf" || 
        originalName.endsWith(".pdf")) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText({ first: 50 });
      const text = sanitizeText(result.text);
      if (parser.destroy) await parser.destroy();
      
      if (detectPromptInjection(text)) {
        return { text: "", error: "INJECTION_DETECTED" }
      }
      return { text, pages: result.total }
    }

    if (mimetype === "text/plain" || 
        mimetype === "text/markdown" ||
        originalName.endsWith(".txt") || 
        originalName.endsWith(".md")) {
      const raw = buffer.toString("utf-8")
      const text = sanitizeText(raw)
      if (detectPromptInjection(text)) {
        return { text: "", error: "INJECTION_DETECTED" }
      }
      return { text }
    }

    return { text: "", error: "UNSUPPORTED_TYPE" }
  } catch (err: any) {
    console.error("[document-processor] error:", err)
    return { text: "", error: "PARSE_FAILED" }
  }
}
