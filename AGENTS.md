# ZachCourse — Agent Architecture

This document describes every AI agent in ZachCourse, how it works, what it uses, and where the code lives.

---

## Overview

ZachCourse is built around **five specialized agents**, each responsible for a distinct part of the learning experience. They share a common infrastructure (Vercel AI SDK v7, Gemini via `@ai-sdk/google`, Zod schemas, NeonDB) but operate independently with no shared state at runtime.

```
User Request
     │
     ▼
Express Server (server.ts)
     │
     ├── POST /api/generate-roadmap   → Roadmap Agent
     ├── POST /api/generate-visual-roadmap → Visual Roadmap Agent
     ├── POST /api/generate-lesson    → Lesson Agent
     ├── POST /api/generate-quiz      → Quiz Agent
     ├── POST /api/mentor-chat        → Mentor Agent  ← agentic loop
     └── tRPC /api/trpc               → Progress Agent (DB reads/writes)
```

All routes protected by `requireAuth` middleware (Better Auth session check) and `aiRateLimit` (20 req/min per IP via `express-rate-limit`).

---

## Agent 1 — Roadmap Agent

**File:** `server.ts` → `POST /api/generate-roadmap`

**Purpose:** Takes a topic, URL, or raw syllabus text and generates a structured week-by-week learning roadmap.

**Technique:** `generateObject` with a strict Zod schema — the model is forced to return validated JSON matching the schema exactly. No free-text parsing required.

**Input:**
```typescript
{
  topic: string,          // max 500 chars
  sourceUrl?: string,     // optional reference URL
  textContent?: string,   // optional pasted syllabus, capped at 3000 chars in prompt
  experienceLevel: "beginner" | "intermediate" | "advanced",
  weeklyHours: number
}
```

**Output schema (Zod):**
```typescript
z.object({
  title: z.string(),
  description: z.string(),
  difficulty: z.string(),
  totalDuration: z.string().optional(),
  prerequisites: z.array(z.string()),
  modules: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    lessons: z.array(z.object({
      id: z.string(),
      title: z.string(),
      duration: z.string(),
      concepts: z.array(z.string()),
      difficulty: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
    }))
  }))
})
```

**Prompt rules:**
- 3–5 modules, each with 3–5 lessons
- Progressive difficulty
- Last lesson must be a hands-on project
- First lesson completable in under 30 minutes
- Depth adapts to `experienceLevel`

**Fallback:** `getLocalFallbackRoadmap()` — returns a hardcoded template if all Gemini models fail.

**Model:** `callAI()` helper — tries `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.5-pro` in order.

---

## Agent 2 — Visual Roadmap Agent

**File:** `server.ts` → `POST /api/generate-visual-roadmap`

**Purpose:** Generates a full node-graph roadmap (20–35 nodes, 25–40 edges) rendered by `@xyflow/react` on the frontend.

**Technique:** `generateObject` with an extended Zod schema covering node types, edge types, resources, and difficulty levels.

**Output schema (key fields):**
```typescript
z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(["start","module","lesson","milestone","project","end"]),
    label: z.string(),
    description: z.string(),
    duration: z.string().optional(),
    difficulty: z.enum(["Beginner","Intermediate","Advanced"]).optional(),
    concepts: z.array(z.string()).optional(),
    resources: z.array(z.object({
      title: z.string(),
      type: z.enum(["video","article","doc","practice"]),
      url: z.string().optional(),
    })).optional(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.enum(["required","optional","parallel"]),
  })),
})
```

**Graph rules enforced in prompt:**
- Exactly one `start` node (id: `"start"`)
- Exactly one `end` node (id: `"end"`)
- Milestones gate each module transition
- At least 2 project nodes (portfolio-worthy builds)
- Optional side-path nodes for going deeper
- First lesson: 20 minutes. Final project: 2–4 hours.

**Supports:** User's own Gemini API key via `x-user-key` header.

---

## Agent 3 — Lesson Agent

**File:** `server.ts` → `POST /api/generate-lesson`

**Purpose:** Generates a full markdown study guide for a specific lesson.

**Technique:** `generateText` — free-form markdown output, no schema required.

**Input:**
```typescript
{
  lessonTitle: string,
  courseTopic: string,
  concepts: string[],
  experienceLevel: string
}
```

**Output:** Raw markdown string — rendered in the frontend via `react-markdown`.

**Saved to:** `LessonContent` table in NeonDB (upserted per `courseId` + `lessonId`) via `trpc.saveLessonContent`, so the same lesson is never generated twice for the same user.

---

## Agent 4 — Quiz Agent

**File:** `server.ts` → `POST /api/generate-quiz`

**Purpose:** Generates exactly 3 adaptive multiple-choice questions for any lesson.

**Technique:** `generateObject` with a strict Zod schema — forces exactly 3 questions, each with 4 options and a correct index.

**Input:**
```typescript
{
  lessonTitle: string,
  lessonContent?: string   // capped at 600 chars to minimize tokens
}
```

**Output schema (Zod):**
```typescript
z.object({
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().min(0).max(3),
    explanation: z.string(),
  })).length(3)
})
```

**Difficulty distribution enforced in prompt:** 1 easy, 1 medium, 1 hard.

**Score persistence:** Scores written to `Course.completedQuizzes` (JSON field) via `trpc.updateCourseProgress`.

**Fallback:** `getLocalFallbackQuiz()` — returns hardcoded MCQs if all models fail.

---

## Agent 5 — Mentor Agent (Agentic)

**File:** `server.ts` → `POST /api/mentor-chat`

**Purpose:** Acts as a persistent personal tutor. Answers questions, reads URLs, searches the web, and maintains full conversation history per course.

**Technique:** `generateText` with registered tools and an **agentic loop** (`stopWhen: isStepCount(5)`). The agent decides how many tool calls to make before responding — up to 5 steps per message.

**Tools:**

### `fetchUrl`
```typescript
tool({
  description: "Fetch and read the content of any URL...",
  inputSchema: z.object({
    url: z.string().url(),
    reason: z.string(),
  }),
  execute: async ({ url }) => {
    // SSRF protection: blocks 169.254.169.254, metadata.google.internal,
    // localhost, 127.0.0.1, 0.0.0.0, ::1, and all RFC-1918 private ranges
    // Protocol check: only http:// and https:// allowed
    // Fetches with 8s timeout, strips <script>, <style>, <nav>, <footer>
    // Returns clean text capped at 8000 chars
  }
})
```

### `searchWeb`
```typescript
tool({
  description: "Search the web using DuckDuckGo...",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // DuckDuckGo instant answer API — no API key required
    // Returns AbstractText + top 4 RelatedTopics
    // 5s timeout
  }
})
```

**Agentic loop flow:**
```
User message
    │
    ▼
Step 1: Model decides whether to call a tool
    │
    ├── Calls fetchUrl(url) → reads page → continues
    ├── Calls searchWeb(query) → reads results → continues
    └── Has enough context → generates final response
    │
    ▼
Steps 2–5: Can call more tools if needed
    │
    ▼
Final text response → saved to CourseMessage table
```

**Memory:** Full conversation history stored in `CourseMessage` table per course. Last 8 messages sent as context per request (token-optimized). Messages survive browser refresh, session expiry, and device switches.

**System prompt context:** Receives `currentCourseTitle` and `currentLessonTitle` on every call so responses are always scoped to what the user is studying.

**Model cascade:** `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.5-pro`. Retries on 503/429/overloaded errors with 1.5s sleep between attempts.

**Supports:** User's own Gemini API key via `x-user-key` header (bypasses server-side quota entirely).

---

## MCP Server — ZachCourse Tools

**File:** `mcp_server.ts`

**Purpose:** Exposes `fetchUrl` and `searchWeb` as a standalone MCP (Model Context Protocol) server so any MCP-compatible client (Claude Desktop, Cursor, etc.) can use ZachCourse's web tools externally.

**Transport:** `StdioServerTransport` — runs as a local process.

**Start:** `npm run mcp` (via `npx tsx mcp_server.ts`)

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "zachcourse-tools": {
      "command": "npx",
      "args": ["tsx", "/path/to/zachcourse/mcp_server.ts"]
    }
  }
}
```

**Tools exposed:**
- `fetchUrl(url, reason)` — same SSRF protection as main server
- `searchWeb(query)` — DuckDuckGo instant answers

---

## Progress Agent — tRPC Layer

**File:** `src/server/trpc.ts`

**Purpose:** Not an AI agent — but acts as ZachCourse's **memory and state layer**. Reads and writes all learning progress to NeonDB, providing the persistent state that makes the AI agents context-aware across sessions.

**Procedures:**

| Procedure | Type | What it does |
|---|---|---|
| `getUserProgress` | query | Gets or creates `UserProgress` record |
| `updateUserProgress` | mutation | Updates streak, hours, quiz scores |
| `getCourses` | query | Lists all user's courses for sidebar |
| `getCourse` | query | Gets single course + last 50 messages |
| `createCourse` | mutation | Creates course + sends mentor welcome message |
| `updateCourseProgress` | mutation | Writes completed lessons + quiz scores |
| `addCourseMessage` | mutation | Persists a mentor chat message |
| `deleteCourse` | mutation | Deletes course (ownership-verified) |
| `renameCourse` | mutation | Renames course (ownership-verified) |
| `getLessonContent` | query | Fetches cached lesson markdown |
| `saveLessonContent` | mutation | Upserts generated lesson content |
| `saveVisualRoadmap` | mutation | Persists a visual roadmap |
| `updateVisualRoadmapProgress` | mutation | Updates completed node IDs in graph |

**Auth:** All procedures use `protectedProcedure` — throws `UNAUTHORIZED` if no active session.

---

## Security

| Layer | Mechanism |
|---|---|
| Route auth | `requireAuth` middleware on all AI routes — Better Auth session check |
| Rate limiting | `express-rate-limit`: 20 req/min per IP on all AI endpoints |
| Body size | `express.json({ limit: "2mb" })` |
| Input validation | Max 500 chars topic, 2000 chars message, 10000 chars textContent |
| SSRF protection | `fetchUrl` blocks private IPs, metadata endpoints, non-http protocols |
| HTTP headers | `helmet` — sets XSS, clickjacking, MIME sniffing protection headers |
| Ownership checks | tRPC mutations verify `course.userId === ctx.user.id` before any write/delete |
