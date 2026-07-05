import { tool } from "ai";
import { z } from "zod";
import { isBlockedUrlResolved } from "./ssrf-guard";

export const fetchUrlTool = tool({
  description: "Fetch and read the content of any URL.",
  inputSchema: z.object({
    url: z.string().url(),
    reason: z.string(),
  }),
  execute: async ({ url, reason }: { url: string; reason: string }) => {
    try {
      if (await isBlockedUrlResolved(url)) {
        throw new Error("Access to internal/private hosts or unsupported protocols is forbidden.");
      }
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 8000);
      const response = await fetch(url, { signal: abort.signal, headers: { "User-Agent": "ZachCourse-MentorBot/1.0" } });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let html = await response.text();
      let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
                      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
                      .replace(/<[^>]+>/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();
      if (clean.length > 8000) clean = clean.slice(0, 8000) + "... (truncated)";
      return { success: true, content: clean, url };
    } catch (err: any) {
      return { success: false, error: String(err.message), content: "", url };
    }
  }
});

export const searchWebTool = tool({
  description: "Search the web for current information.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }: { query: string }) => {
    try {
      const encoded = encodeURIComponent(query);
      const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      const results = [
        data.AbstractText && `Summary: ${String(data.AbstractText)}`,
        ...(data.RelatedTopics || []).slice(0, 4).map((t: any) => String(t.Text)).filter(Boolean)
      ].filter(Boolean).join("\n\n");
      return { query, results: results || `No direct summary found for '${query}'. Consider rephrasing the question or providing a specific URL to fetch instead.`, source: String(data.AbstractURL || "DuckDuckGo") };
    } catch (err: any) {
      return { query, results: "Search failed: " + String(err.message), source: "" };
    }
  }
});
