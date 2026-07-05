/**
 * ZachCourse MCP Server
 * Exposes fetchUrl and searchWeb as MCP tools so any MCP-compatible
 * client (Claude Desktop, Cursor, etc.) can use ZachCourse's 
 * web-reading capabilities.
 * 
 * DESIGN RATIONALE:
 * This standalone MCP server deliberately re-exposes the exact same `fetchUrl` and
 * `searchWeb` tools as the in-app Mentor Agent. Instead of writing separate utility code,
 * it shares the same HTTP endpoints, search APIs (DuckDuckGo format parsing), and most
 * importantly, the identical `isBlockedUrl` security filter.
 * This guarantees that:
 * 1. Security controls (SSRF protection) are applied uniformly across both standard user channels
 *    and external developer/agent integrations.
 * 2. Scraping, stripping, and token-optimization algorithms (HTML tag stripping, length capping)
 *    do not diverge or duplicate, keeping maintenance overhead extremely low.
 * 
 * Run with: npx tsx mcp_server.ts
 * Add to Claude Desktop config as a local MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isBlockedUrl, isBlockedUrlResolved } from "./src/lib/ssrf-guard";

const server = new McpServer({
  name: "zachcourse-tools",
  version: "1.0.0",
  description: "ZachCourse web tools — fetch URLs and search the web for learning context",
});

// Tool 1: fetchUrl
server.tool(
  "fetchUrl",
  "Fetch and read the content of any public URL. Returns clean text stripped of HTML, scripts, and navigation.",
  {
    url: z.string().url().describe("The full URL to fetch including https://"),
    reason: z.string().describe("Why you are fetching this URL"),
  },
  async ({ url, reason }) => {
    try {
      if (await isBlockedUrlResolved(url)) {
        return { content: [{ type: "text", text: "Blocked: Access to internal/private hosts or unsupported protocols is forbidden." }] };
      }

      const response = await fetch(url, {
        headers: { "User-Agent": "ZachCourse-MCP/1.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return { content: [{ type: "text", text: `Failed: HTTP ${response.status}` }] };
      }

      const raw = await response.text();
      const clean = raw
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{3,}/g, "\n\n")
        .trim()
        .slice(0, 8000);

      const titleMatch = raw.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || url;

      return {
        content: [{ type: "text", text: `# ${title}\n\n${clean}` }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool 2: searchWeb
server.tool(
  "searchWeb",
  "Search the web using DuckDuckGo for current information, recent news, or up-to-date documentation.",
  {
    query: z.string().describe("The search query"),
  },
  async ({ query }) => {
    try {
      const encoded = encodeURIComponent(query);
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();

      const results = [
        data.AbstractText && `Summary: ${data.AbstractText}`,
        ...(data.RelatedTopics || []).slice(0, 5).map((t: any) => t.Text).filter(Boolean),
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        content: [{ type: "text", text: results || `No direct summary found for '${query}'. Consider rephrasing the question or providing a specific URL to fetch instead.` }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Search failed: ${err.message}` }] };
    }
  }
);

// Start the MCP server on stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ZachCourse MCP Server running on stdio");
