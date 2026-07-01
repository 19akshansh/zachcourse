# ZachCourse — Technical Specification

**Version:** 1.0  
**Stack:** Vite + React 19 + TypeScript + Express.js  
**Deployment:** Google Cloud Run  
**Live:** https://ais-dev-fg6nnldzwvuyvu3rsspevg-53963441605.asia-east1.run.app

---

## 1. Purpose

ZachCourse is a multi-agent AI learning companion. It takes any topic, URL, or syllabus text and generates a personalized course — week-by-week roadmap, AI mentor chat, adaptive quizzes, and persistent progress tracking. Multiple courses can run simultaneously per user, each with its own conversation history, like ChatGPT sessions but for learning.

**Core problem:** Online course completion rates sit at 5–15%. The missing ingredient is personalization and someone to ask questions to at 2am. ZachCourse provides both.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Vite + React + TypeScript | React 19, Vite 6 |
| Styling | Tailwind CSS | v4 |
| Backend | Express.js | 4.x |
| API layer | tRPC | v11 |
| Auth | Better Auth | v1.2+ |
| ORM | Prisma | 5.x |
| Database | NeonDB (PostgreSQL) | Serverless |
| AI SDK | Vercel AI SDK | v7 (`ai` + `@ai-sdk/google`) |
| AI Model | Google Gemini | 2.5 Flash / 2.0 Flash / 2.5 Pro |
| Canvas | @xyflow/react (ReactFlow) | v12 |
| MCP | @modelcontextprotocol/sdk | 1.x |
| Email | Nodemailer + Gmail SMTP | — |
| Deployment | Google Cloud Run | asia-east1 |
| Markdown | react-markdown | — |
| Toasts | Sonner | — |
| Icons | Lucide React | — |
| Validation | Zod | 3.x |

---

## 3. Architecture

### 3.1 High-Level

```
Browser (Vite SPA)
        │
        │  HTTP (cookies, credentials: include)
        ▼
Express Server (server.ts)
        │
        ├── /api/auth/*          Better Auth handlers
        ├── /api/trpc/*          tRPC adapter → src/server/trpc.ts → NeonDB
        ├── /api/generate-*      AI agent routes → Gemini API
        ├── /api/mentor-chat     Agentic loop with tools
        ├── /api/ai              Guest proxy (quota-gated)
        ├── /api/verify-star     GitHub star check
        └── /*                  Vite SPA static files
```

### 3.2 Single Process

The Express server and Vite SPA share a single Node.js process. In development, Express proxies Vite's HMR server. In production (Cloud Run), Express serves the pre-built Vite `dist/` folder as static files.

### 3.3 Data Flow

```
User: "I want to learn Python"
            │
            ▼
App.tsx → POST /api/generate-roadmap
            │
            ▼
Roadmap Agent (Gemini generateObject + Zod)
            │
            ▼
trpc.createCourse → NeonDB (Course table)
            │
            ▼
Sidebar updates, first lesson auto-selects
            │
            ▼
User clicks lesson → POST /api/generate-lesson
            │
            ▼
Lesson Agent (Gemini generateText)
            │
            ▼
trpc.saveLessonContent → NeonDB (LessonContent table)
            │
            ▼
User asks mentor a question → POST /api/mentor-chat
            │
            ▼
Mentor Agent (agentic loop, tools, history from NeonDB)
            │
            ▼
trpc.addCourseMessage x2 → NeonDB (CourseMessage table)
```

---

## 4. Database Schema

### User
Standard Better Auth user. Relations: courses, visualRoadmaps, userProgress.

### UserProgress
One row per user. Tracks: `currentCourse`, `streakDays`, `totalHoursLogged`, `quizScores` (JSON), `completedTopics` (JSON), `weeklyGoalHours`, `lastSeenAt`.

### Course
One row per course per user. Key fields:
- `roadmapData` (JSON) — full roadmap object from Roadmap Agent
- `completedLessons` (JSON array of lesson IDs)
- `completedQuizzes` (JSON object: `{ lessonId: score }`)
- `currentLessonId` — last active lesson

### CourseMessage
Chat history. `role`: `"user"` | `"assistant"`. `content`: full message text. Ordered by `createdAt`. Last 50 messages returned per course fetch, last 8 sent to Mentor Agent per request.

### LessonContent
Cached lesson markdown per `courseId` + `lessonId`. Upserted — never regenerated for the same user/lesson pair.

### VisualRoadmap
Standalone visual graph roadmaps. Stores full node/edge JSON from Visual Roadmap Agent. `completedNodeIds` (JSON array). `isFavorite` (boolean) for pinning.

---

## 5. Authentication

**Provider:** Better Auth v1.2+

**Methods:**
- Email + password (with email verification required)
- Google OAuth
- GitHub OAuth

**Session:** Cookie-based (`better-auth.session_token`). tRPC client sends `credentials: "include"` on every request so the session cookie is forwarded correctly.

**Email:** Nodemailer + Gmail SMTP app password. Sends verification emails, password reset emails. Configured via `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` env vars.

**OAuth callbacks:**
- `{APP_URL}/api/auth/callback/google`
- `{APP_URL}/api/auth/callback/github`

**Post-login:** `window.location.href = "/dashboard"` with 500ms delay to allow session cookie to settle.

---

## 6. API Reference

### AI Routes (all require auth + rate limit)

#### `POST /api/generate-roadmap`
```
Body: { topic, sourceUrl?, textContent?, experienceLevel, weeklyHours }
Returns: { roadmap: RoadmapObject }
Errors: 400 (missing params / too long), 500 (AI failure)
```

#### `POST /api/generate-visual-roadmap`
```
Body: { topic, experienceLevel, weeklyHours, sourceUrl? }
Headers: x-user-key (optional, user's own Gemini key)
Returns: { roadmap: VisualRoadmapObject }
```

#### `POST /api/generate-lesson`
```
Body: { lessonTitle, courseTopic, concepts[], experienceLevel }
Returns: { content: string (markdown) }
```

#### `POST /api/generate-quiz`
```
Body: { lessonTitle, lessonContent? }
Returns: { questions: MCQQuestion[3] }
```

#### `POST /api/mentor-chat`
```
Body: { message, history[], currentCourseTitle?, currentLessonTitle? }
Headers: x-user-key (optional)
Returns: { reply: string }
Validation: message max 2000 chars, history max 20 items
```

#### `POST /api/ai` (guest proxy)
```
Body: { message, systemPrompt? }
Rate limited: 20/min + guest quota check
Returns: { reply: string }
```

#### `GET /api/verify-star`
```
Query: { username }
Returns: { hasStarred: boolean }
```

### tRPC Procedures

All require authenticated session. See `AGENTS.md` for full procedure list.

---

## 7. AI Model Configuration

### Model Cascade
```typescript
const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];
```
Tries each in order. Retries on 503/429/overloaded. Breaks on auth/other errors.

### Token Optimization
- Mentor history: last 8 messages only, each capped at 1000 chars
- Quiz content: capped at 600 chars
- Roadmap textContent: capped at 3000 chars in prompt
- Lesson content: never sent to quiz agent (only title used)

### Structured Output
`generateObject` used for Roadmap, Visual Roadmap, and Quiz agents. Zod schemas enforce output shape at the type level — no JSON parsing errors possible.

### Agentic Loop
Mentor Agent uses `stopWhen: isStepCount(5)` — agent decides number of tool calls (0–5) per response. Tool results feed back into context before final generation.

---

## 8. Frontend Architecture

### Router
No routing library. `App.tsx` reads `window.location.pathname` and renders the appropriate view. Navigation via `window.location.href` (full page loads). Defined in `src/lib/router.ts`.

### State
All app state lives in `App.tsx`:

| State | Type | Source |
|---|---|---|
| `session` | Better Auth session | `useSession()` |
| `courses` | CourseListItem[] | tRPC `getCourses` |
| `activeCourse` | Course (with messages) | tRPC `getCourse` |
| `activeCourseId` | string \| null | local useState |
| `activeTab` | "roadmap"\|"mentor"\|"quiz"\|"progress" | local useState |
| `userDbProgress` | UserProgress | tRPC `getUserProgress` |

### localStorage (only 3 keys)
```
zc_user_key      — user's Gemini API key
zc_sidebar       — sidebar collapsed state (boolean)
zc_roadmap_view  — "list" | "graph" toggle
```

Everything else is in NeonDB.

### Key Components

| Component | Purpose |
|---|---|
| `AppSidebar` | Course list + nav tabs, collapsible (256px / 64px), mobile overlay |
| `AppHeader` | Sticky bar, hamburger, KeyStatusBadge, avatar dropdown |
| `RoadmapGraph` | SVG-based lesson list with completion state |
| `VisualRoadmapGraph` | ReactFlow node-graph with pan/zoom/minimap |
| `ApiKeyOnboarding` | Full-page key setup for new users |
| `ProductTour` | react-joyride onboarding tour for first-time users |
| `UnlockModal` | Quota exceeded / key required modal |

---

## 9. Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | NeonDB pooled connection string | ✅ |
| `DIRECT_URL` | NeonDB direct connection (for migrations) | ✅ |
| `BETTER_AUTH_SECRET` | Random secret for session signing | ✅ |
| `BETTER_AUTH_URL` | Full app URL (used by Better Auth) | ✅ |
| `APP_URL` | Full app URL | ✅ |
| `VITE_APP_URL` | Full app URL (exposed to frontend) | ✅ |
| `GEMINI_API_KEY` | Server-side Gemini key | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | OAuth only |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | OAuth only |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | OAuth only |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | OAuth only |
| `EMAIL_HOST` | SMTP host (`smtp.gmail.com`) | ✅ |
| `EMAIL_PORT` | SMTP port (`587`) | ✅ |
| `EMAIL_SECURE` | TLS flag (`false` for 587) | ✅ |
| `EMAIL_USER` | Gmail address | ✅ |
| `EMAIL_PASS` | Gmail app password | ✅ |
| `EMAIL_FROM` | Display name + address | ✅ |

---

## 10. Development Setup

```bash
git clone https://github.com/19akshansh/zachcourse
cd zachcourse
npm install

# Copy and fill env vars
cp .env.example .env

# Run Prisma migration
npx prisma migrate deploy
npx prisma generate

# Start dev server (Express + Vite HMR together)
npm run dev
```

**Dev server:** Express on port 3000, Vite HMR proxied through it.  
**Build:** `npm run build` → Vite outputs to `dist/`, Express serves it.  
**MCP server:** `npm run mcp` → runs `mcp_server.ts` on stdio.

---

## 11. Deployment (Google Cloud Run)

The app runs as a single container. Cloud Run spins it up on request and scales to zero when idle — no charges during inactivity.

**Key settings:**
- Minimum instances: 0 (scale to zero)
- Memory: 512MB+
- Port: 8080 (Cloud Run default, Express listens on `process.env.PORT || 3000`)
- Region: asia-east1

**Build command:** `npm run build`  
**Start command:** `node dist/server.js` (or via `tsx server.ts` in development)

---

## 12. MCP Server

`mcp_server.ts` exposes ZachCourse's web tools as a standalone MCP server.

**Exposed tools:** `fetchUrl`, `searchWeb` (same implementations as Mentor Agent, same SSRF guards).  
**Transport:** stdio  
**Use case:** Connect to Claude Desktop or Cursor to use ZachCourse's URL-reading capability in any AI workflow.

---

## 13. Known Limitations

- No streaming in mentor chat — full response waits before rendering
- DuckDuckGo instant answer API returns limited results for niche queries
- `LessonContent` cached forever — no invalidation if course topic changes
- Visual roadmap generation can take 15–25 seconds for complex topics
- GitHub star verification uses public GitHub API (60 req/hr unauthenticated limit)
