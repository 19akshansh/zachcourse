# ZachCourse — Technical Specification

This document details the system design, complete database schema, API and tRPC routes, and security measures of the **ZachCourse** personalized learning platform.

---

## 1. System Architecture Overview

ZachCourse is a full-stack, multi-agent AI-powered learning platform. It is designed around clean boundaries separating the frontend, server, and multi-agent AI systems.

```
                  ┌─────────────────────────────────┐
                  │          Vite + React           │
                  │      (PWA, @xyflow/react)       │
                  └────────────────┬────────────────┘
                                   │
                                   │ (tRPC & Express JSON)
                                   ▼
                  ┌─────────────────────────────────┐
                  │         Express Server          │
                  │       (server.ts / CJS)         │
                  └──────┬───────────────────┬──────┘
                         │                   │
                         ▼                   ▼
                  ┌──────────────┐   ┌──────────────┐
                  │    Prisma    │   │  Gemini SDK  │
                  │ (PostgreSQL) │   │ & Vercel AI  │
                  └──────────────┘   └──────────────┘
```

---

## 2. Database Schema (Prisma PostgreSQL)

ZachCourse uses PostgreSQL with pgvector enabled for semantic retrieval (RAG).

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector]
}

model User {
  id             String          @id @default(cuid())
  name           String
  email          String          @unique
  emailVerified  Boolean         @default(false)
  image          String?
  role           String          @default("student") // "student" | "teacher"
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  accounts       Account[]
  courses        Course[]
  visualRoadmaps VisualRoadmap[]
  sessions       Session[]
  userProgress   UserProgress?
  lessonMemories LessonMemory[]
  cohortsOwned   Cohort[]        @relation("CohortOwner")
  cohortMemberships CohortMember[]
  projects       Project[]

  @@map("user")
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  expiresAt             DateTime?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("account")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}

model UserProgress {
  id               String    @id @default(cuid())
  userId           String    @unique
  currentCourse    String?
  currentCourseUrl String?
  currentWeek      Int       @default(1)
  totalWeeks       Int       @default(0)
  streakDays       Int       @default(0)
  lastSeenAt       DateTime?
  totalHoursLogged Float     @default(0)
  quizScores       Json      @default("[]")
  completedTopics  Json      @default("[]")
  weeklyGoalHours  Int       @default(5)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_progress")
}

model Course {
  id                 String          @id @default(cuid())
  userId             String
  title              String
  description        String?
  topic              String
  sourceUrl          String?
  difficulty         String          @default("Beginner")
  totalDuration      String?
  prerequisites      Json            @default("[]")
  experienceLevel    String          @default("beginner")
  backgroundContext  String?
  tone               String          @default("friendly")
  weeklyHours        Int             @default(5)
  isActive           Boolean         @default(true)
  roadmapData        Json
  completedLessons   Json            @default("[]")
  completedQuizzes   Json            @default("{}")
  currentLessonId    String?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  user               User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages           CourseMessage[]
  lessonContents     LessonContent[]
  lessonMemories     LessonMemory[]
  projects           Project[]
  clonedFromCourseId String?
  cohorts            Cohort[]

  @@map("course")
}

model CourseMessage {
  id        String   @id @default(cuid())
  courseId  String
  role      String   // "user" | "assistant" | "system"
  content   String
  metadata  Json?
  createdAt DateTime @default(now())
  sequence  Int      @default(autoincrement())
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@map("course_message")
}

model LessonContent {
  id             String   @id @default(cuid())
  courseId       String
  lessonId       String
  content        String
  qualityScore   Int?
  evaluationData Json?
  createdAt      DateTime @default(now())
  course         Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([courseId, lessonId])
  @@map("lesson_content")
}

model VisualRoadmap {
  id                  String   @id @default(cuid())
  userId              String
  title               String
  topic               String
  description         String?
  difficulty          String   @default("Beginner")
  totalDuration       String?
  experienceLevel     String   @default("beginner")
  backgroundContext   String?
  tone                String   @default("friendly")
  weeklyHours         Int      @default(5)
  roadmapData         Json
  completedNodeIds    Json     @default("[]")
  isFavorite          Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  clonedFromRoadmapId String?
  cohorts             Cohort[]

  @@map("visual_roadmap")
}

model LessonMemory {
  id          String                    @id @default(cuid())
  userId      String
  courseId    String
  lessonId    String
  lessonTitle String
  chunk       String                    @db.Text
  embedding   Unsupported("vector(768)")
  createdAt   DateTime                  @default(now())
  user        User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  course      Course                    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  
  @@index([userId, courseId])
  @@map("lesson_memory")
}

model Cohort {
  id              String         @id @default(cuid())
  name            String
  ownerId         String
  inviteCode      String         @unique
  isClassroom     Boolean        @default(false)
  courseId        String?
  visualRoadmapId String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  owner           User           @relation("CohortOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  course          Course?        @relation(fields: [courseId], references: [id], onDelete: SetNull)
  visualRoadmap   VisualRoadmap? @relation(fields: [visualRoadmapId], references: [id], onDelete: SetNull)
  members         CohortMember[]

  @@map("cohort")
}

model CohortMember {
  id        String   @id @default(cuid())
  cohortId  String
  userId    String
  joinedAt  DateTime @default(now())
  cohort    Cohort   @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([cohortId, userId])
  @@map("cohort_member")
}

model Project {
  id              String   @id @default(cuid())
  courseId        String
  userId          String
  moduleId        String
  title           String
  description     String
  objectives      Json
  steps           Json
  estimatedHours  Int
  successCriteria Json
  status          String   @default("not_started") // "not_started" | "in_progress" | "completed"
  submissionNote  String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  course          Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([courseId, moduleId])
  @@map("project")
}
```

---

## 3. Core API Routes & tRPC Architecture

All AI endpoints and tRPC procedures are structured as follows:

### Express REST API (AI Agents & Webhooks)
- `POST /api/generate-roadmap`: Generates structured text/JSON course syllabus.
- `POST /api/generate-visual-roadmap`: Generates structured flow-graph datasets for `@xyflow/react`.
- `POST /api/generate-lesson`: Stream/generate rich markdown study guides. Verified by Judge Agent.
- `POST /api/generate-quiz`: Generates adaptive three-part lesson quizzes.
- `POST /api/mentor-chat`: Handles multi-turn mentor conversations, triggering agentic tool execution.

### tRPC Services (Progress, Cohorts, and Classrooms)
All procedures are protected by `requireAuth` checking for an active Better Auth session.

- **Learning Progress & Metrics:**
  - `getUserProgress()` -> Resolves current streak, completed topics, and target learning hours.
  - `updateUserProgress(streakDays, totalHoursLogged)` -> Modifies core streak metadata.
  - `getLearningMetrics()` -> Computes rolling platform statistics.

- **Course Management:**
  - `getCourses()` -> List enrolled courses.
  - `getCourse({ courseId })` -> Fetch metadata, modules, lessons, and last 50 mentor messages.
  - `createCourse({ title, topic, difficulty, experienceLevel, weeklyHours, roadmapData })` -> Initializes a new curriculum.
  - `updateCourseProgress({ courseId, completedLessons, completedQuizzes, currentLessonId })` -> Increments checklist state.

- **Module Projects (Hands-on Learning):**
  - `getModuleProject({ courseId, moduleId })` -> Retrieves the generated project details for a specific course module.
  - `generateProject({ courseId, moduleId, moduleTitle, topic, level })` -> Generates an engaging, beginner-friendly hands-on project suited to the user's course level using the Gemini API.
  - `updateProjectStatus({ projectId, status, submissionNote })` -> Updates the progress status ("not_started", "in_progress", "completed") and optional submission notes of a project.

- **Cohort Systems:**
  - `createCohort({ name, courseId, visualRoadmapId })` -> Sets up a learning cohort bound to a curriculum.
  - `previewCohortByInviteCode({ inviteCode })` -> Fetches name, member count, curriculum details, and an `isAlreadyMember` flag without committing enrollment.
  - `joinCohortAndClone({ inviteCode })` -> Checks if already joined (throwing `CONFLICT` on duplicate attempts), then adds member to cohort and clones target course/roadmap to clean student state.
  - `deleteCohort({ cohortId })` -> Deletes a cohort permanently if the requester is verified as the creator/owner.
  - `leaveCohort({ cohortId })` -> Removes a member from the cohort, while keeping their cloned course/roadmap.
  - `getCohortLeaderboard({ cohortId })` -> Rank members strictly by proficiency calculated from their cohort-linked cloned copies.
  - `getCohortActivity({ cohortId })` -> Streams activity feeds.

- **Teacher Classrooms:**
  - `createClassroom({ name, courseId, visualRoadmapId })` -> Setup classroom bound to a master lesson framework.
  - `getTeacherClassrooms()` -> Query teaching groups.
  - `getClassroomRoster({ classroomId })` -> Returns student list with specialized, scoped metrics.
  - `getStudentDetail({ classroomId, studentId })` -> Breaks down weak areas (score < 70) and course lists for diagnostic reviews.

---

## 4. Platform Security & Guidelines

| Safeguard | Implementation Details |
|:---|:---|
| **SSRF Mitigation** | `fetchUrl` tool filters against RFC 1918 private ranges, localhost (`127.0.0.1`), metadata domains, and non-HTTP/S protocols. |
| **API Rate Limiting** | `express-rate-limit` enforces a maximum of 20 API requests/minute per IP address across all AI routes. |
| **Payload Sanitization** | `express.json` limits payloads to `2mb`. Strict regex filters strip malicious `<script>` components before markdown rendering. |
| **Access Guards** | Database ownership checks query and verify `course.userId === ctx.user.id` or `visualRoadmap.userId === ctx.user.id` on all mutation procedures. |
| **Resource Link Safety** | Prompt-level engineering and server-side/client-side URL sanitization (via `sanitizeResourceUrl` blocklist checks) filter out dummy/placeholder domains (e.g. `example.com`), routing them safely to a dynamic Google Search fallback. |
| **CORS Restriction** | Origin validation rejects any wildcard pattern ending in `*.run.app` or similar shared domains. Only explicitly configured entries in `ALLOWED_ORIGINS` (including the primary deployed service URL) or localhost origins are allowed, blocking cross-origin session hijack attempts from peer container services. |
| **CSP Whitelisting** | Helmet content security policies explicitly permit connection requests to `https://generativelanguage.googleapis.com` to support direct, client-side browser integration of user-provided Gemini API keys without degrading default sandbox protections. |
