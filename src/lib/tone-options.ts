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

