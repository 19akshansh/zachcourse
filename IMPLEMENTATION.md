# ZachCourse — Implementation Notes

This document explains the *why* behind every significant technical decision in ZachCourse — the tradeoffs, the bugs we hit, how we fixed them, and what the vibe coding process actually looked like. It's meant to be read alongside `AGENTS.md` and `SPEC.md`.

---

## 1. Why These Agent Boundaries

The first version was a single endpoint that tried to do everything: take a topic, return a complete personalized learning experience. It was terrible. The model would generate a vague roadmap, a generic lesson, and a useless quiz all in one bloated prompt — and none of them were good.

The breakthrough was realizing that each task has fundamentally different requirements:

- **Roadmaps** need structured JSON output — a free-text response would require fragile parsing
- **Lessons** need long-form markdown — forcing a schema would constrain the writing
- **Quizzes** need exact counts and formats — exactly 3 questions, exactly 4 options each
- **Mentor chat** needs tool use and memory — a one-shot prompt can't read URLs or remember history

Once we split them into four agents with distinct prompts, models, and output strategies, quality jumped immediately. Each agent could be tuned independently. Each could fail independently without taking down the others.

The fifth agent — the Progress Agent — isn't an AI agent at all. It's the tRPC/Prisma layer that gives the AI agents memory. Without it, every session starts from zero. With it, the mentor knows your history, the roadmap shows your completed lessons, and the quiz knows what you've already scored.

---

## 2. Why `generateObject` for Roadmap and Quiz (Not `generateText` + JSON.parse)

Early implementation used `generateText` with "respond only in JSON" in the system prompt and then `JSON.parse()` on the result. This broke constantly:

- Gemini would add markdown code fences (` ```json `) around the output
- Nested arrays would occasionally have trailing commas
- The model would sometimes add explanatory text before the JSON
- Parse errors were silent until they hit the frontend

Switching to `generateObject` with a Zod schema fixed all of this. The Vercel AI SDK handles the schema injection and output parsing internally — the model is constrained at the API level, not just prompted to behave. If the output doesn't match the schema, the SDK throws a typed error rather than returning malformed data.

For the Quiz Agent specifically, `.length(3)` on the questions array and `.length(4)` on each options array means the model is structurally forced to return exactly what the UI expects — no defensive coding needed on the frontend.

```typescript
// This guarantees exactly 3 questions with 4 options each at the type level
z.object({
  questions: z.array(z.object({
    options: z.array(z.string()).length(4),
    correctIndex: z.number().min(0).max(3),
  })).length(3)
})
```

---

## 3. Why the Mentor Agent Uses an Agentic Loop

The first mentor implementation was a single `generateText` call with the user's message. When someone pasted a URL, the model would hallucinate what that page contained — confidently wrong.

Adding the `fetchUrl` tool wasn't enough on its own. The model needs to:
1. Decide to call `fetchUrl`
2. Read the result
3. Optionally call `searchWeb` for additional context
4. Then generate a response that synthesizes everything

That's a multi-step process that a single inference call can't do. `stopWhen: isStepCount(5)` gives the agent a budget of 5 steps per response — enough to fetch a URL, read it, search for supplementary info if needed, and then answer. In practice most responses use 1–3 steps.

The `isStepCount` approach was chosen over streaming because Cloud Run doesn't have a response timeout issue for this duration, and the simpler non-streaming implementation is easier to debug and saves chat history correctly on both user and assistant sides.

---

## 4. Why `fetchUrl` Has SSRF Protection

When you give an AI agent a tool that makes real network requests on behalf of users, you've created a Server-Side Request Forgery vector. Without protection, a malicious user could ask the mentor: *"summarize this page: http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"* — which is the Google Cloud metadata endpoint that returns service account credentials.

The implementation blocks this at the tool execution layer, before any fetch is made:

```typescript
const blockedHosts = [
  "169.254.169.254",           // GCP/AWS metadata endpoint
  "metadata.google.internal",  // GCP metadata alternate
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",                       // IPv6 localhost
];
const isPrivateIp = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsedUrl.hostname);
```

The protocol check (`only http/https allowed`) blocks `file://`, `ftp://`, and other schemes that could be used to read local files or probe internal services.

The same blocklist is applied identically in the MCP server (`mcp_server.ts`) so the security guarantee is consistent whether the tool is called from the Express server or from an external MCP client.

---

## 5. Why tRPC Over Plain REST

The entire data layer is tRPC v11. The main reason was end-to-end type safety — the `AppRouter` type is imported directly into the frontend, so any procedure rename or input schema change is a TypeScript compile error immediately rather than a runtime 400 at 2am before a deadline.

The secondary reason is that tRPC eliminates an entire category of boilerplate. Every REST API needs: route definition, request body type, response type, error handling, fetch wrapper, response parsing. tRPC collapses this into a single `.query()` or `.mutate()` call that's fully typed.

The one tradeoff: tRPC required `credentials: "include"` on every fetch for the session cookie to be forwarded — this wasn't obvious initially and caused the first major production bug (see Bug Fixes section below).

---

## 6. Why Better Auth Over NextAuth or Custom JWT

Better Auth was chosen for three reasons:

1. **Not tied to Next.js** — this project uses Vite + Express, not Next.js. NextAuth is built around Next.js API routes. Better Auth has a clean Express adapter (`toNodeHandler`).
2. **Email + OAuth in one package** — email/password with verification, Google OAuth, GitHub OAuth all configured in ~40 lines.
3. **Cookie-based sessions** — no JWT management on the frontend. The session token lives in an httpOnly cookie, forwarded automatically with `credentials: "include"`.

---

## 7. Why NeonDB (Serverless PostgreSQL)

The app is deployed on Cloud Run which scales to zero. A traditional PostgreSQL server running 24/7 on a VM would cost money even when nobody is using the app. NeonDB is serverless — it also scales to zero and bills per query, not per uptime.

The Prisma schema uses two connection strings:
- `DATABASE_URL` — the pooled connection (used at runtime, handles concurrent requests)
- `DIRECT_URL` — the direct connection (used by `prisma migrate` only, bypasses the pooler)

This is a NeonDB-specific requirement. Using the pooler for migrations causes errors because migrations need a persistent connection, not a pooled one.

---

## 8. Why Lesson Content Is Cached in the Database

The first implementation called `/api/generate-lesson` every time a user clicked a lesson. This meant:
- 3–8 second wait every single click
- Re-generating identical content on every visit
- Burning Gemini API quota on repeated identical prompts

The fix was `LessonContent` — a table with a unique constraint on `(courseId, lessonId)`. On lesson click:

```typescript
// Check cache first
const saved = await trpc.getLessonContent.query({ courseId, lessonId });
if (saved) {
  setLessonContent(saved.content); // instant
  return;
}

// Only call AI if not cached
const content = await fetch("/api/generate-lesson", ...);
await trpc.saveLessonContent.mutate({ courseId, lessonId, content });
```

First view: 3–8 seconds. Every subsequent view: instant. The lesson is generated exactly once per user per lesson, forever.

---

## 9. The Model Cascade — Why Three Models

`callAI()` tries three models in order: `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.5-pro`.

The reason isn't speed — it's availability. Gemini 2.5 Flash is the fastest and cheapest, but it returns 503/429 errors during high demand periods. Rather than showing users an error, the cascade automatically falls through to the next model.

The retry logic distinguishes retryable errors from fatal ones:

```typescript
const isRetryable =
  msg.includes("503") ||
  msg.includes("429") ||
  msg.includes("overloaded") ||
  msg.includes("quota") ||
  msg.includes("high demand");

if (!isRetryable) break; // auth errors, malformed requests — don't retry
await sleep(1500);       // wait before trying next model
```

Non-retryable errors (auth failures, schema violations, malformed requests) break immediately — no point trying the next model for those.

The Mentor Agent has its own identical cascade because it uses `generateText` with tools rather than going through `callAI()`, which only handles `generateObject`/`generateText` without tool support.

---

## 10. Token Optimization Decisions

Token costs compound fast with an agentic system. Several deliberate limits:

**Mentor history truncation:** Last 8 messages only, each capped at 1000 characters. After 20+ messages, sending the full history adds thousands of tokens per request. 8 messages covers enough context for continuity without runaway costs.

**Quiz content cap:** `lessonContent.slice(0, 600)`. The quiz agent doesn't need the full lesson — it needs enough context to generate relevant questions. 600 chars is sufficient.

**Roadmap textContent cap:** `textContent.slice(0, 3000)` in the prompt string. Users sometimes paste entire syllabi. 3000 chars (about 750 tokens) is enough for the model to extract curriculum structure.

**Lesson content not sent to quiz:** Only `lessonTitle` and `concepts` are sent. The full lesson markdown is never forwarded to the quiz route.

**System prompt repetition:** The mentor system prompt (~300 tokens) is repeated on every call. This is a known cost but acceptable — without it, the model loses its teaching persona and tool-use instructions.

---

## 11. Bug Fixes — What Actually Broke

### Bug 1: tRPC "Failed to fetch" on dashboard load

**Symptom:** Dashboard loaded but immediately showed "Error loading progress via tRPC: Failed to fetch" in the console. All tRPC calls failed silently.

**Cause:** `httpBatchLink` in `trpc-client.ts` wasn't forwarding the session cookie. The browser's default `fetch` omits cookies for same-origin requests unless `credentials: "include"` is explicitly set.

**Fix:**
```typescript
httpBatchLink({
  url: "/api/trpc",
  fetch: (url, options) =>
    window.fetch(url, { ...options, credentials: "include" }),
})
```

One line. Fixed everything.

### Bug 2: Mentor returning "I couldn't generate a response"

**Symptom:** Pasting a Kaggle competition URL into mentor chat returned a canned error message instead of a summary.

**Cause:** Two separate issues. First, the `fetchUrl` tool was returning `{ success: false }` for URLs that required JavaScript rendering (Kaggle uses React). Second, when the tool returned empty content, the model had no instruction on what to do next, so `result.text` came back as an empty string, hitting the `|| "I couldn't generate a response."` fallback.

**Fix:** Updated the system prompt with explicit rules for tool failure:
```
2. fetchUrl returns success:false → tell the user the page blocked access,
   then answer from your training knowledge about that topic.
4. You MUST always produce a helpful text response. Never return empty output.
6. Never say "I couldn't generate a response" — that is a forbidden output.
```

Added a hard fallback:
```typescript
const reply = text?.trim();
res.json({
  reply: reply || "I ran into an issue — try rephrasing or paste the content directly.",
});
```

### Bug 3: Rename/Delete context menu intercepted by overlay

**Symptom:** Right-clicking a course in the sidebar showed the context menu, but clicking Rename or Delete closed the menu without doing anything.

**Cause:** A `position: fixed; inset: 0; z-index: 40` overlay div was catching the click before the menu buttons (z-index: 50) could fire. The buttons and overlay were siblings in the DOM, and the overlay was rendered after the menu, so even though it had lower z-index, the `mousedown` event bubbled to it first.

**Fix:** Removed the overlay div entirely. Replaced with a `useEffect` + `document.addEventListener("mousedown")` pattern that checks if the click target is inside the menu using `closest("[data-context-menu]")`. Added `e.stopPropagation()` on both buttons.

### Bug 4: deleteCourse wiping all user progress

**Symptom:** Deleting a course also deleted the user's entire progress record — streaks, quiz scores, everything.

**Cause:** An earlier version of `deleteCourse` in `trpc.ts` called `userProgress.deleteMany({ where: { userId } })` — wiping the entire `UserProgress` row. This was a leftover from an older schema where progress was course-scoped.

**Fix:** Removed the `deleteMany` call entirely. Course deletion now only deletes the `Course` record. Progress is stored separately and is never affected by course operations.

### Bug 5: Wrong Gemini model IDs

**Symptom:** Every AI call was slower than expected and the `callAI` logs showed model failures before succeeding.

**Cause:** The model cascade started with `"gemini-3.5-flash"` — a model ID that doesn't exist. Every call would fail on the first model, sleep 1.5 seconds, then succeed on `"gemini-2.5-flash"`. Users experienced a 1.5 second unnecessary delay on every AI interaction.

**Fix:** Updated to real model IDs: `"gemini-2.5-flash"` → `"gemini-2.0-flash"` → `"gemini-2.5-pro"`.

---

## 12. The Vibe Coding Process

This project was built during the Google x Kaggle 5-Day AI Agents Intensive using Google AI Studio's agent coding environment.

The process looked roughly like this:

**Day 1 — Design in natural language.** Described the agent architecture, database schema, and user flow to the AI agent before writing any code. Getting the architecture right in conversation first meant the implementation was mostly mechanical. The AI generated the Prisma schema, the tRPC router, and the Express server skeleton from a single detailed description.

**Day 2 — Agent implementation.** The Roadmap and Quiz agents were straightforward once the `generateObject` + Zod pattern was established. The Mentor Agent took longer — the first version didn't use tools at all, just `generateText`. Adding tool calling and the agentic loop required understanding what `stopWhen: isStepCount(5)` actually does (it's not a retry limit — it's a step budget for the entire tool-call chain).

**Day 3 — Bug fixing and security.** This is where human judgment mattered most. The AI would fix a bug as described but sometimes introduce a new one in the process, or miss the root cause and patch a symptom. The SSRF protection, rate limiting, and input validation were designed by the developer and implemented by the AI — the threat model required human reasoning about what could go wrong.

**Day 4 — Polish and UI.** ReactFlow for the visual roadmap, responsive fixes, the product tour. The AI was effective at CSS/Tailwind work given precise descriptions of what was wrong.

**Day 5 — Documentation.** These files. The agent is good at writing documentation from code it can read, but the implementation notes (the *why*) required the developer to explain decisions the code doesn't make explicit.

The honest assessment: vibe coding is fastest when you know exactly what you want and can describe it precisely. It's slowest when you're debugging something subtle — the AI will generate plausible-looking fixes that don't address the root cause. The best workflow was: identify the root cause yourself, then describe the fix to the AI rather than describing the symptom.

---

## 13. Known Limitations and What We'd Fix Next

**No streaming in mentor chat.** The full response waits before rendering. This makes long mentor responses feel slow. `streamText` with SSE would fix it — the implementation exists in the Vercel AI SDK, the Express route just needs to switch from `res.json()` to `res.write()` with chunked transfer encoding.

**DuckDuckGo instant answers are shallow.** The `searchWeb` tool returns DuckDuckGo's instant answer API which is fast and keyless but limited. For niche technical queries it often returns nothing useful. A proper search integration (Tavily, Brave Search API) would significantly improve the mentor's research capability.

**Lesson content cached forever.** There's no cache invalidation. If a user regenerates a course on the same topic, the old lesson content persists. A version hash or `updatedAt` check on the course would fix this.

**Visual roadmap generation is slow.** 20–35 nodes with resources takes 15–25 seconds to generate. The prompt is large and the schema is complex. Pre-generation on course creation (rather than on-demand) would fix the perceived latency.

**Guest mode is one query.** The 1-query guest limit exists to protect the server-side Gemini key. A better UX would be a 3-query trial with a clear upgrade path rather than a hard wall after one message.
