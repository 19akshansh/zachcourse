export const TONE_OPTIONS = [
  { id: "friendly", icon: "😊", label: "Friendly" },
  { id: "professional", icon: "💼", label: "Professional" },
  { id: "genz", icon: "🔥", label: "Gen Z" },
  { id: "eli5", icon: "🧒", label: "ELI5" },
] as const;

export const TONE_INSTRUCTIONS: Record<string, string> = {
  friendly: `Write in a warm, supportive, encouraging voice — like a patient friend who's also an expert. Use analogies, occasional emojis, and well-spaced headers. This is the current default ZachCourse voice — don't change its character.`,
  professional: `Write in a clear, precise, professional register appropriate for corporate technical training or documentation. No slang, no emojis, minimal exclamation points. Prioritize accuracy and concision over cheerleading — respect the reader's time and intelligence.`,
  genz: `Write in a casual, high-energy, internet-native voice — contractions, short punchy sentences, current slang used naturally where it fits (not forced or overloaded). Keep it fun, but never let the voice get in the way of actually teaching the concept correctly — accuracy and clarity still come first.`,
  eli5: `Explain as if to someone with zero background in the subject. Define every piece of jargon in plain language the first time it's used, lean heavily on everyday analogies, and prefer short sentences over dense technical ones.`,
};

export const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: `Generate ALL user-visible content exclusively in English.
Do not mix English with English.
Preserve Markdown formatting.
Preserve JSON structure (keys must remain exactly as defined in the schema, translate only values).
Do not translate IDs or technical keys.
Do not translate code blocks or Mermaid diagram syntax keywords.
Translate only user-visible text, labels, titles, descriptions, and content.
Technical terminology should remain untranslated only when commonly used in English natively.`,
  es: `Generate ALL user-visible content exclusively in Spanish (español).
Do not mix English with Spanish (español).
Preserve Markdown formatting.
Preserve JSON structure (keys must remain exactly as defined in the schema, translate only values).
Do not translate IDs or technical keys.
Do not translate code blocks or Mermaid diagram syntax keywords.
Translate only user-visible text, labels, titles, descriptions, and content.
Technical terminology should remain untranslated only when commonly used in Spanish (español) natively.`,
  fr: `Generate ALL user-visible content exclusively in French (français).
Do not mix English with French (français).
Preserve Markdown formatting.
Preserve JSON structure (keys must remain exactly as defined in the schema, translate only values).
Do not translate IDs or technical keys.
Do not translate code blocks or Mermaid diagram syntax keywords.
Translate only user-visible text, labels, titles, descriptions, and content.
Technical terminology should remain untranslated only when commonly used in French (français) natively.`,
  de: `Generate ALL user-visible content exclusively in German (Deutsch).
Do not mix English with German (Deutsch).
Preserve Markdown formatting.
Preserve JSON structure (keys must remain exactly as defined in the schema, translate only values).
Do not translate IDs or technical keys.
Do not translate code blocks or Mermaid diagram syntax keywords.
Translate only user-visible text, labels, titles, descriptions, and content.
Technical terminology should remain untranslated only when commonly used in German (Deutsch) natively.`,
  hi: `Generate ALL user-visible content exclusively in Hindi (हिन्दी) - Use Devanagari script.
Do not mix English with Hindi (हिन्दी) - Use Devanagari script.
Preserve Markdown formatting.
Preserve JSON structure (keys must remain exactly as defined in the schema, translate only values).
Do not translate IDs or technical keys.
Do not translate code blocks or Mermaid diagram syntax keywords.
Translate only user-visible text, labels, titles, descriptions, and content.
Technical terminology should remain untranslated only when commonly used in Hindi (हिन्दी) - Use Devanagari script natively.`,
  zh: `Generate ALL user-visible content exclusively in Chinese (中文).
Do not mix English with Chinese (中文).
Preserve Markdown formatting.
Preserve JSON structure (keys must remain exactly as defined in the schema, translate only values).
Do not translate IDs or technical keys.
Do not translate code blocks or Mermaid diagram syntax keywords.
Translate only user-visible text, labels, titles, descriptions, and content.
Technical terminology should remain untranslated only when commonly used in Chinese (中文) natively.`,
  ar: `Generate ALL user-visible content exclusively in Arabic (العربية).
Do not mix English with Arabic (العربية).
Preserve Markdown formatting.
Preserve JSON structure (keys must remain exactly as defined in the schema, translate only values).
Do not translate IDs or technical keys.
Do not translate code blocks or Mermaid diagram syntax keywords.
Translate only user-visible text, labels, titles, descriptions, and content.
Technical terminology should remain untranslated only when commonly used in Arabic (العربية) natively.`,
};


