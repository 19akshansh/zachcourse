import { PDFParse } from "pdf-parse"

// Explicit pattern names and regexes for easier debugging/logging
const INJECTION_PATTERNS = [
  { name: "ignore_instructions", regex: /ignore\s+(all\s+)?previous\s+instructions/i },
  { name: "you_are_now", regex: /you\s+are\s+now\s+(a|an|the)/i },
  { name: "system_prompt", regex: /system\s*prompt/i },
  { name: "disregard_all", regex: /disregard\s+(the\s+)?above/i },
  { name: "new_instructions", regex: /new\s+instructions\s*:/i },
  { name: "forget_everything", regex: /forget\s+everything/i },
  { name: "override_instructions", regex: /override\s+(your\s+)?instructions/i },
  { name: "act_as", regex: /act\s+as\s+(a|an|the|your|system|assistant)/i },
  { name: "role_is", regex: /your\s+new\s+role\s+is/i },
  { name: "not_follow", regex: /do\s+not\s+follow/i },
  { name: "role_header", regex: /(^|\n)\[?(system|assistant|user|instructor|instruction|response)\]?\s*:/i },
  { name: "markdown_role_header", regex: /(^|\n)(#+|\*+|-+)\s*(system|assistant|user|instruction|response)/i },
  { name: "long_base64_blob", regex: /[A-Za-z0-9+/]{80,}={0,2}/ }, // Suspicious long encoded strings that might contain instruction vectors
]

/**
 * Normalizes input text to eliminate evasion techniques such as homoglyphs,
 * mixed Unicode characters, zero-width spaces, and specialized spacing/formatting.
 */
function normalizeText(text: string): string {
  if (!text) return ""
  return text
    .normalize("NFKD") // Unpack accents, bolding, italics, or other styling to plain characters
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, "") // Strip zero-width/direction control characters
    // Map common homoglyphs or lookalikes if present to standard Latin equivalents
    .replace(/[аа]/g, "a") // Cyrillic to Latin 'a'
    .replace(/[ее]/g, "e") // Cyrillic to Latin 'e'
    .replace(/[оо]/g, "o") // Cyrillic to Latin 'o'
    .replace(/[сс]/g, "c") // Cyrillic to Latin 'c'
    .replace(/[рр]/g, "p") // Cyrillic to Latin 'p'
    .replace(/\s+/g, " ") // Collapse multiple whitespaces/newlines to single space
    .trim()
}

/**
 * Heuristically detects potential prompt injection attempts in parsed text.
 * 
 * NOTE: This pattern-matching detector is a heuristic FIRST LINE OF DEFENSE,
 * not an absolute safety guarantee. Highly sophisticated or obfuscated injection
 * techniques could bypass pattern matching.
 * 
 * The true architectural safety boundary of ZachCourse is how downstream prompts
 * handle this text in server.ts: ingested user or document text is strictly wrapped
 * in `<document_context>` XML-style block delimiters, explicitly labeled as
 * untrusted context/data, and never interpolated directly as instructions.
 * 
 * @returns An array of matched pattern names for logging, or `null` if the text is clean.
 */
export function detectPromptInjection(text: string): string[] | null {
  const normalized = normalizeText(text)
  const matches: string[] = []

  for (const { name, regex } of INJECTION_PATTERNS) {
    if (regex.test(normalized)) {
      matches.push(name)
    }
  }

  return matches.length > 0 ? matches : null
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

