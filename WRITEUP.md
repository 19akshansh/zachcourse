# ZachCourse: A Multi-Agent AI Learning Companion

> **Capstone Submission — Google x Kaggle AI Agents Intensive Vibe Coding Course 2026**

> **Track: Agents for Good — Education**

> **Live Demo:** https://zachcourse-955328668699.asia-southeast1.run.app

> **Video:** https://youtu.be/fVWvpGBCMc8

---

## Key Concepts Demonstrated

| Concept | Where to Find It |
| :--- | :--- |
| **Agent / Multi-agent system** | Seven agents — Roadmap, Visual Roadmap, Lesson, Quiz, Mentor, Judge, Critic — each a server route or inline evaluator with its own Zod-validated schema (`server.ts`) |
| **RAG / long-term memory** | `src/lib/memory.ts` — chunks lesson text and mentor exchanges, embeds with `text-embedding-004`, stores vectors in pgvector for retrieval that grounds the Mentor beyond its 8-message window |
| **Document ingestion** | `POST /api/process-documents` + `document-processor.ts` — parses uploaded PDF/text syllabi, sanitizes them, and screens for prompt-injection patterns before any text reaches a model |
| **MCP Server** | `mcp_server.ts` — a fully functional `@modelcontextprotocol/sdk` server exposing `fetchUrl` and `searchWeb` as MCP tools over stdio transport. Run with `npm run mcp`. |
| **Security features** | SSRF protection in `fetchUrl`, prompt-injection screening on uploads, `express-rate-limit` on every AI endpoint, `helmet` with custom CSP, `requireAuth` middleware, input length caps, Zod input validation |
| **Deployability** | Deployed on Google Cloud Run at the live URL above. Full build pipeline: `vite build` + `esbuild` bundling. `npm run start` launches the production server. |
| **Agent skills** | `fetchUrl` and `searchWeb` implemented as callable tool skills inside the Mentor agent's agentic loop. Gemini autonomously decides when to invoke them. |

---

## Problem

The way people learn online is broken. Platforms like Coursera and Udemy offer static, one-size-fits-all courses written for the average learner, not for you. When you get stuck, you leave to search Stack Overflow, YouTube, and docs, and lose your flow.

The core problem is that existing platforms are content libraries, not learning systems. They can't generate a roadmap for your exact background, explain a concept until it clicks, quiz you on what you just read, or read the URL you just pasted and tell you what it means for your project.

ZachCourse is what happens when you build a learning platform with agents at the center instead of bolted on afterward.

---

## Solution Overview

ZachCourse turns any topic, URL, or syllabus into a fully personalized, interactive course in under 30 seconds. The system:

- **Generates a structured roadmap** from a topic, URL, uploaded syllabus, or raw text — modules, lessons, prerequisites, durations — adapted to experience level and hours per week.
- **Ingests source documents:** upload a PDF/text syllabus (max 3 files, 10MB each) and sanitized text seeds the Roadmap Agent instead of a blank prompt.
- **Creates lesson content on demand** — rich Markdown, generated only when opened, then cached.
- **Runs adaptive quizzes** with configurable count and difficulty, tracking scores per course.
- **Provides a persistent AI mentor with long-term memory** — remembers course history, reads shared URLs, searches the web, and recalls semantically relevant past lessons via vector search, not just recent messages.
- **Tracks progress on an analytics dashboard** — streaks, hours, quiz averages, and an estimated-proficiency score.
- **Supports group learning** via Cohorts/Classrooms: students join by invite code and get an isolated cloned copy, with a leaderboard scoped to that cohort.
- **Lets learners bring their own Gemini key**, validated client-side, with trial credits for those without one.
- **Saves everything to PostgreSQL** except the API key, which stays in `localStorage`.

---

## Technical Architecture

![System Overview](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2Fa6d542683ac334cb9e37c56967a54acb%2Fzachcourse_system_overview_branded.svg?generation=1782887338712365&alt=media)

The application is a **Vite + React 19 SPA** served by an **Express.js** backend. All AI calls happen server-side; client code never touches a model credential.

**Stack:**

| Layer | Technology |
| :--- | :--- |
| Frontend | Vite, React 19, Tailwind CSS v4, ReactFlow + dagre |
| Backend | Express.js, tRPC v11 |
| AI & Agents | Vercel AI SDK v7, `@ai-sdk/google`, Gemini API |
| Database | NeonDB (PostgreSQL), Prisma ORM |
| Auth | Better Auth (email + Google + GitHub OAuth) |
| MCP | `@modelcontextprotocol/sdk` v1.29 |

**Model strategy:** a three-model fallback chain — `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.5-pro` — with automatic retry on `429`/`503`/overloaded responses, so the app degrades gracefully instead of crashing under quota pressure.

---

## The Agent System

![User Journey](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F502e3794f6f00283d7c724e1648c6f36%2Fzachcourse_user_journey_branded.svg?generation=1782887367908912&alt=media)

ZachCourse is built around seven specialized agents plus a guarded document pipeline, each scoped to exactly the context it needs:

### 1. Roadmap Agent
Uses `generateObject()` with a strict Zod schema to produce validated JSON roadmaps — modules, lessons, edge connections, and resources. Schema enforcement means no JSON parsing fragility; invalid output is rejected before it reaches the database.

### 2. Lesson Agent
Uses `generateText()` to generate rich Markdown lesson content, cached in PostgreSQL after first generation so a lesson is never regenerated for the same user.

### 3. Quiz Agent
Uses `generateObject()` to generate N multiple-choice questions at a set difficulty (easy, mixed, hard), each with an explanation fetched lazily only when a learner gets one wrong.

### 4. Mentor Agent — Agentic Loop
The core agentic feature: `generateText()` with two callable tool skills and a `stopWhen: isStepCount(5)` loop:

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

**`fetchUrl`:** fetches a public URL, strips HTML/scripts/nav/footers, and returns clean text (max 8,000 chars), with SSRF protection blocking cloud metadata endpoints and private IP ranges. **`searchWeb`:** queries DuckDuckGo's instant-answer API (no key required) for current information. Pasting a URL into chat gets it actually read, not hallucinated.

The last 8 messages of history give the mentor multi-turn memory within a session; full history persists in PostgreSQL across sessions.

### 5. Memory Agent — Retrieval-Augmented Recall
A recency window forgets anything outside the last 8 messages. The Memory Agent (`src/lib/memory.ts`) chunks lesson content and mentor Q&A into ~500-character pieces, embeds them with Gemini's `text-embedding-004`, and stores the vectors in a `pgvector` column. Each mentor turn embeds the query and retrieves the top 5 chunks above a 0.7 cosine-similarity threshold, so the mentor can recall a concept from three lessons — or three weeks — ago, not just this session.

### 6. Judge Agent
Runs inline after Lesson generation, scoring the draft on clarity, accuracy, depth, and engagement. A `needs_revision`/`fail` verdict triggers one automatic re-generation before the learner sees it.

### 7. Critic Agent
Runs inline after (Visual) Roadmap generation, checking for illogical ordering, bad time estimates, or invalid graph structure, and returns revision notes that re-prompt the original agent on rejection.

### Document Ingestion Pipeline
A guarded preprocessing step, not a model call. `POST /api/process-documents` accepts up to 3 PDF/text files (10MB max each), extracts and sanitizes text, caps it at 50,000 characters, and screens it for prompt-injection patterns before it ever reaches a model prompt — a rejected document surfaces a clear error instead of silently poisoning the Roadmap Agent's context.

---

## MCP Server

`mcp_server.ts` exposes ZachCourse's `fetchUrl` and `searchWeb` as a standard MCP server (`npm run mcp`, stdio transport), so any MCP-compatible client — Claude Desktop, Cursor — can call the same tools the Mentor uses. ZachCourse isn't just a consumer of the MCP ecosystem; it contributes to it.

---

## Cohorts, Classrooms & Analytics

**Cohorts & Classrooms:** An owner or teacher links a Cohort to one Course or Visual Roadmap. Students join by invite code, preview the content, then get the roadmap skeleton cloned into their own profile with progress reset to zero (`clonedFromCourseId`/`clonedFromRoadmapId`) — lesson text is never copied, so each student's Lesson Agent still generates content lazily. Leaderboards and teacher rosters compute proficiency scoped strictly to that cohort's cloned copies.

**Analytics Dashboard:** `computeUserMetrics()` aggregates streaks, hours, completed lessons, and quiz scores into a weekly activity view and one estimated-proficiency score (70% quiz average, 30% lesson completion).

---

## Bring-Your-Own-Key Onboarding

New users get a cookie-based trial-credit balance ("star bonus") so they can try the product immediately without a shared, rate-limited server key. To go further, they paste a personal Gemini key, which is validated with a live low-token test call (`validateUserKey` — distinguishing an invalid key from a merely rate-limited one), then stored only in `localStorage` and sent via an `x-user-key` header, never persisted server-side.

---

## Security

Security was designed in, not added after:

- **SSRF protection:** `fetchUrl` blocks cloud metadata endpoints, localhost, and all RFC-1918 private ranges; only `http:`/`https:` are permitted.
- **Rate limiting & auth gating:** `express-rate-limit` on every AI endpoint; `requireAuth` middleware blocks unauthenticated AI calls.
- **Input validation:** message length and history size capped; Zod validates every tRPC input before it reaches the database.
- **Structured outputs:** `generateObject()` with Zod schemas type-checks AI output before storage and rejects malformed responses.
- **Credential separation:** user API keys live only in `localStorage`, sent via header, never stored server-side.
- **Upload screening & ownership checks:** documents are sanitized and scanned for prompt-injection patterns before reaching a model; cohort/classroom mutations verify ownership.

---

## Vibe Coding Workflow

ZachCourse was built entirely inside **Google AI Studio**: describe the feature in plain English, review the generated code, iterate by refining the prompt rather than the code, then test against real inputs. Features that would have taken days of boilerplate — ReactFlow with dagre auto-layout, the cohort clone-on-join flow, the auth stack — shipped in hours, freeing time for architecture decisions over syntax.

**Prompt engineering and software architecture are the same activity at different abstraction levels** — both decompose a problem into well-scoped, testable units with clear interfaces.

---

## Evaluation

Testing covered: roadmap generation across 10+ topics and uploaded syllabi; lesson/Markdown quality; quiz consistency; mentor URL fetching and web search; memory retrieval relevance; cohort join/clone and leaderboard scoping; auth flows; mobile responsiveness (375–1440px); malformed structured-output handling; and model fallback under simulated quota exhaustion.

---

## Challenges and Trade-offs

**Context size vs latency:** passing full lesson content to the mentor improved quality but added latency. Fixed by passing only title and concepts, and letting the Memory Agent's vector search pull in older context on demand.

**localStorage vs database:** early progress storage in `localStorage` broke across devices; everything but the API key moved to PostgreSQL.

**Structured output reliability:** manual JSON parsing was inconsistent; `generateObject()` with Zod schemas eliminated parsing errors entirely.

**Trust boundary for agent inputs:** `fetchUrl` and uploaded documents both carry attacker-controlled text into a prompt — SSRF blocking and the document injection-pattern screen address the same risk from two entry points.

**Fair metrics in shared curricula:** cloning the roadmap skeleton (not lesson text) at join time, and scoping leaderboard queries to cloned IDs, kept cohort metrics honest without duplicating generated content.

---

## Lessons Learned

- An agentic loop that calls tools and observes results beats a single-shot prompt with the same instructions.
- Structured output schemas are the highest-ROI investment in AI application reliability.
- Security in agentic systems means reasoning about what the agent can be instructed to do — by a fetched page or an uploaded file — not just what the user types.
- Vector search is a cheap complement to short recency windows once conversations span sessions.
- Vibe coding works best when the developer owns architecture and invariants, delegating implementation to AI.

---

## Conclusion

ZachCourse proves that putting agents at the center of a learning platform — rather than bolting AI onto an existing content library — produces something qualitatively different. The Mentor reasons, fetches, searches, and now remembers across sessions via vector retrieval; the Roadmap Agent architects a curriculum from a topic, URL, or uploaded syllabus; Judge and Critic agents quality-check output before it reaches the learner; and Cohorts scale that same personalization to a classroom without sacrificing per-student accuracy.

This foundation — a real MCP server, SSRF- and injection-guarded ingestion, schema-validated outputs, persistent RAG memory, model fallback chains — was built to production standards because education deserves reliability.

![Tech Stack](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F79a600e51dd3972d441d66f3eb9dc43d%2Fzachcourse_tech_stack_branded.svg?generation=1782887421630954&alt=media)
![System Architecture](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F6a0701a4119b213b52540e3e1dcf19b1%2Fzachcourse_architecture_fixed.svg?generation=1782887444798891&alt=media)
