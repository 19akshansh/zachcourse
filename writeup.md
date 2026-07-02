# ZachCourse: A Multi-Agent AI Learning Companion

> **Capstone Submission — Google x Kaggle AI Agents Intensive Vibe Coding Course 2026**

> **Track: Agents for Good — Education**

> **Live Demo:** https://zachcourse-955328668699.asia-southeast1.run.app

> **Video:** https://youtu.be/fVWvpGBCMc8

---

## Key Concepts Demonstrated

| Concept | Where to Find It |
| :--- | :--- |
| **Agent / Multi-agent system** | Four specialized agents: Roadmap, Lesson, Quiz, Mentor — each a separate server route with its own Zod-validated prompt and structured output schema (`server.ts` lines 426–960) |
| **MCP Server** | `mcp_server.ts` — a fully functional `@modelcontextprotocol/sdk` server exposing `fetchUrl` and `searchWeb` as MCP tools over stdio transport. Run with `npm run mcp`. |
| **Security features** | SSRF protection in `fetchUrl` (blocks `169.254.169.254`, `metadata.google.internal`, and all RFC-1918 private IP ranges), `express-rate-limit` on every AI endpoint, `helmet` with custom CSP, `requireAuth` middleware, input length caps, Zod input validation |
| **Deployability** | Deployed on Google Cloud Run at the live URL above. Full build pipeline: `vite build` + `esbuild` bundling. `npm run start` launches the production server. |
| **Agent skills** | `fetchUrl` and `searchWeb` implemented as callable tool skills inside the Mentor agent's agentic loop. Gemini autonomously decides when to invoke them. |

---

## Problem

The way people learn online is broken. Platforms like Coursera and Udemy offer static, one-size-fits-all courses that were written for the average learner — not for you specifically. When you get stuck, you leave the platform and spend 20 minutes searching Stack Overflow, YouTube, and documentation tabs. When you come back, you've lost your flow.

The core problem is that existing platforms are content libraries, not learning systems. They can't generate a roadmap for your exact background. They can't explain a concept three different ways until it clicks. They can't quiz you on what you actually just read. And they certainly can't read the Kaggle competition page you just pasted into chat and tell you what it means for your project.

ZachCourse is what happens when you build a learning platform with agents at the center instead of bolted on afterward.

---

## Solution Overview

ZachCourse turns any topic, URL, or syllabus into a fully personalized, interactive course in under 30 seconds. The system:

- **Generates a structured roadmap** from a topic name, URL, or raw text — modules, lessons, prerequisites, and estimated durations, all adapted to the learner's experience level and available hours per week.
- **Creates lesson content on demand** — rich Markdown with analogies, code examples, and key takeaways, generated only when the learner opens that lesson (not pre-baked).
- **Runs adaptive quizzes** with configurable question count and difficulty, tracking correct/incorrect ratios per course in the database.
- **Provides a persistent AI mentor** that remembers your full course history, reads external URLs you share, searches the web for current information, and explains anything — not just course topics.
- **Saves everything to PostgreSQL** — courses, chat histories, lesson content, quiz scores, completed lessons, and visual roadmap progress. Nothing lives in localStorage except your API key.

---

## Technical Architecture

![System Overview](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2Fa6d542683ac334cb9e37c56967a54acb%2Fzachcourse_system_overview_branded.svg?generation=1782887338712365&alt=media)

The application is a **Vite + React 19 SPA** served by an **Express.js** backend. All AI calls happen server-side — client code never touches a model credential directly.

**Stack:**

| Layer | Technology |
| :--- | :--- |
| Frontend | Vite, React 19, Tailwind CSS v4, ReactFlow + dagre |
| Backend | Express.js, tRPC v11 |
| AI & Agents | Vercel AI SDK v7, `@ai-sdk/google`, Gemini API |
| Database | NeonDB (PostgreSQL), Prisma ORM |
| Auth | Better Auth (email + Google + GitHub OAuth) |
| MCP | `@modelcontextprotocol/sdk` v1.29 |

**Model strategy:** The system uses a three-model fallback chain — `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.5-pro` — with automatic retry on `429`, `503`, and "overloaded" responses. The application never crashes under quota pressure; it degrades gracefully and communicates clearly to the user.

---

## The Agent System

![User Journey](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F502e3794f6f00283d7c724e1648c6f36%2Fzachcourse_user_journey_branded.svg?generation=1782887367908912&alt=media)

ZachCourse is built around four specialized agents, each scoped to exactly the context it needs:

### 1. Roadmap Agent
Uses `generateObject()` with a strict Zod schema to produce validated JSON roadmaps — modules, lessons, edge connections, difficulty levels, and resource recommendations. Because the output is schema-enforced, there is no JSON parsing fragility. Invalid output is rejected at the type level before it reaches the database.

### 2. Lesson Agent
Uses `generateText()` with a structured prompt to generate rich Markdown lesson content. Output is cached in PostgreSQL after first generation — the learner never pays tokens for the same lesson twice.

### 3. Quiz Agent
Uses `generateObject()` to generate N multiple-choice questions at a specified difficulty level (easy, mixed, hard). Each question includes an explanation. Incorrect answers expose a "Why was I wrong?" button that lazily fetches an AI explanation only when requested — avoiding unnecessary token usage for users who don't need it.

### 4. Mentor Agent — Agentic Loop
This is the core agentic feature. The mentor uses `generateText()` with two callable tool skills and a `stopWhen: isStepCount(5)` loop:

```
User message received
        ↓
Gemini reasons: does this need a tool?
        ↓ (if yes)
fetchUrl(url) OR searchWeb(query) executes
        ↓
Tool result injected into context
        ↓
Gemini reasons again — another tool needed?
        ↓ (repeat up to 5 steps)
Final grounded text response
```

**`fetchUrl` tool:** Fetches any public URL, strips HTML/scripts/nav/footers, and returns clean text (max 8,000 chars). Includes SSRF protection blocking cloud metadata endpoints and all RFC-1918 private ranges.

**`searchWeb` tool:** Queries DuckDuckGo's instant-answer API (no key required) for current information, recent news, and up-to-date documentation.

The Mentor does not hallucinate URL contents. If a learner pastes `https://www.kaggle.com/competitions/vibecoding-agents-capstone-project` into chat, Gemini calls `fetchUrl`, reads the actual page, and answers based on real content — not training data.

The last 8 messages of conversation history are included as structured message context, giving the mentor genuine multi-turn memory within each session. Full conversation history is stored in PostgreSQL and reloaded across sessions.

---

## MCP Server

`mcp_server.ts` exposes ZachCourse's web-reading capabilities as a standard MCP server, making them available to any MCP-compatible client including Claude Desktop and Cursor.

```bash
npm run mcp   # Starts the MCP server on stdio transport
```

Tools exposed:
- `fetchUrl(url, reason)` — fetch and read any public URL
- `searchWeb(query)` — search DuckDuckGo for current information

This means ZachCourse's `fetchUrl` tool — the same one the Mentor agent uses — can be called by external agents as a skill. ZachCourse is not just a consumer of the MCP ecosystem; it contributes to it.

---

## Security

Security was designed in, not added after:

- **SSRF protection:** `fetchUrl` blocks requests to `169.254.169.254` (AWS/GCP metadata), `metadata.google.internal`, `localhost`, `127.0.0.1`, `::1`, and all RFC-1918 private IP ranges (`10.x`, `172.16-31.x`, `192.168.x`). Protocol is validated — only `http:` and `https:` are permitted.
- **Rate limiting:** `express-rate-limit` applied to all AI-generating endpoints. Prevents quota exhaustion from automated abuse.
- **Auth gating:** `requireAuth` middleware on every AI route. Unauthenticated users cannot trigger AI calls.
- **Input validation:** Message length capped at 2,000 characters. History array capped at 20 messages. Zod validates all tRPC inputs before they reach the database.
- **Structured outputs:** `generateObject()` with Zod schemas means AI output is type-checked before storage. Malformed responses are rejected.
- **Credential separation:** User-provided API keys are stored in `localStorage` only — never sent to or stored on the server. Server uses its own `GEMINI_API_KEY` only for server-proxied requests.

---

## Vibe Coding Workflow

ZachCourse was built entirely inside **Google AI Studio** using a natural-language-first development workflow:

1. Describe the feature or component in plain English
2. Review the generated code for correctness and architectural fit
3. Iterate — refine the prompt, not the code directly
4. Test manually against real inputs
5. Repeat

This workflow changed what was possible in the time available. Features that would have taken days of boilerplate — the visual ReactFlow roadmap with dagre auto-layout, the quiz setup screen with difficulty selectors, the full auth flow with email verification — were shipped in hours. The developer's time shifted from writing syntax to making decisions: which architecture pattern to use, which prompt produces consistent output, which edge cases matter.

The key insight from this workflow: **prompt engineering and software architecture are the same activity at different abstraction levels.** Both are about decomposing a problem into well-scoped, testable units with clear interfaces.

---

## Responsible AI

- All AI features require authentication — no anonymous abuse
- Server-side model orchestration — API keys never reach client code
- SSRF protection prevents the agent from being used to probe internal infrastructure
- Input length limits prevent context injection attacks via oversized messages
- Structured outputs with schema validation prevent hallucinated data from reaching the database
- Rate limiting on all AI endpoints prevents automated quota exhaustion
- User API keys stored only in `localStorage` — the server never sees or stores them

---

## Evaluation

Testing focused on functional correctness and edge case robustness:

- Roadmap generation across 10+ diverse topics (programming, design, science, business)
- Lesson content quality and Markdown rendering accuracy
- Quiz consistency across difficulty levels
- Mentor URL fetching with valid, broken, and private URLs
- Mentor web search with current and historical queries
- Auth flows: signup, email verification, Google OAuth, GitHub OAuth
- Mobile responsiveness across 375px–1440px
- Malformed JSON handling in structured outputs
- tRPC error handling with optimistic UI rollback
- Model fallback behavior under simulated quota exhaustion

---

## Challenges and Trade-offs

**Context size vs latency:** Passing full lesson content to the mentor improved answer quality but added tokens and latency. The solution was to pass only the current lesson title and concept list, not the full text — quality remained high while response time dropped.

**localStorage vs database for progress:** Early iterations stored course progress in `localStorage`. This created a broken experience across devices and after clearing browser data. All progress was moved to PostgreSQL. Only the API key stays in `localStorage` — by design, since it should never leave the user's browser.

**Structured output reliability:** Early roadmap generation used plain `generateText()` with JSON parsing. Output was inconsistent. Switching to `generateObject()` with Zod schemas eliminated parsing errors entirely — the model is constrained to produce valid output or the call fails cleanly.

**SSRF in tool-calling agents:** When Gemini calls `fetchUrl` autonomously, it may be instructed by a prompt-injected page to fetch internal resources. Blocking cloud metadata endpoints and private IP ranges was essential, not optional.

---

## Lessons Learned

- An agentic loop that can call tools and observe their results produces fundamentally different (and better) answers than a single-shot prompt with the same instructions.
- Structured output schemas are the single highest-ROI investment in AI application reliability.
- Security in agentic systems requires thinking about what the agent can be instructed to do, not just what the user can input.
- Vibe coding is most powerful when the developer focuses on architecture — what to build, how to structure it, what invariants to maintain — and delegates implementation to AI.

---

## Conclusion

ZachCourse proves that putting agents at the center of a learning platform — rather than bolting AI onto an existing content library — produces something qualitatively different. The Mentor doesn't just retrieve stored answers; it reasons, fetches, searches, and responds to the learner's actual context in real time. The Roadmap Agent doesn't serve pre-built courses; it architects a curriculum from scratch for your specific goal and schedule.

The technical foundation — real MCP server, SSRF-protected tool execution, schema-validated structured outputs, persistent multi-session memory, model fallback chains — was built to production standards because education deserves reliability. A learning tool that breaks when quota is tight or crashes on malformed AI output teaches the wrong lesson.

Built for the **Google x Kaggle 5-Day AI Agents Intensive Vibe Coding Capstone 2026**, Education track.

![Tech Stack](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F79a600e51dd3972d441d66f3eb9dc43d%2Fzachcourse_tech_stack_branded.svg?generation=1782887421630954&alt=media)
![System Architecture](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F6a0701a4119b213b52540e3e1dcf19b1%2Fzachcourse_architecture_fixed.svg?generation=1782887444798891&alt=media)
