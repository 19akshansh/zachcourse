# ZachCourse — Implementation Notes

This document provides development guidelines, build script configurations, multi-agent execution frameworks, and visual interface implementations of ZachCourse.

---

## 1. Development & Build System

ZachCourse runs as a full-stack Node.js server. Because production environments enforce strict ES module relative path checks and require optimal container cold-starts, we compile and bundle our backend server into a single CJS bundle.

### package.json Config Scripts
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs"
  }
}
```

- **Vite Build:** Compiles the React single-page application into static files within `/dist`.
- **Esbuild Transpilation:** Combines TypeScript source code (`server.ts`) and CJS-resolves all modules to build `/dist/server.cjs`. We leverage `--packages=external` to ensure that heavy node packages (e.g., Prisma, Express) remain as external references in `node_modules` instead of being bloated into the bundle.

---

## 2. Multi-Agent Coordination Flow

Every AI-driven interaction in ZachCourse is handled by a sequence of specialized AI agents built with the Gemini API (using the `@ai-sdk/google` provider or `@google/genai` libraries).

```
User Action
    │
    ▼
Check cache (NeonDB / LessonContent table)
    │
    ├── [HIT]  ──► Return pre-saved markdown
    └── [MISS] ──► Cascade Models ──► Evaluate (Judge/Critic) ──► Save & Return
```

### Cascade & Fallback Mechanism
To ensure absolute reliability, all core agents leverage a model-cascade fallback loop:
1. Try `gemini-2.5-flash` for blazing-fast speed and low cost.
2. If unavailable, throttle, or fail, fall back to `gemini-2.0-flash`.
3. If issues persist, invoke `gemini-2.5-pro` as the heavy, highly resilient backup model.
4. Hardcoded offline JSON templates act as a final local fail-safe if all internet models are unavailable.

### Evaluation Pipelines (Inline QA)
- **Judge Agent (Lesson Builder):** Validates generated markdown lesson texts. It computes structured scores for *Clarity*, *Accuracy*, *Depth*, and *Engagement*. If the output earns a `needs_revision` or `fail` verdict, the system automatically triggers a re-generation loop.
- **Critic Agent (Roadmap Builder):** Inspects generated graph networks before rendering them on screen. It ensures logical dependencies, valid chronological timelines, and that start/end milestones are properly defined.

### Adaptive Module Project Generator
- **Adaptive Phrasing and Phasing:** Hands-on projects generated via `generateProject` feature a model instructions layer specifically optimized to be beginner-friendly.
- **Dynamic Scoping:** When the topic level is "Beginner" or the topic is brand-new, the prompt strictly enforces a reduction in estimated work hours (targeting 1–2 hours maximum), strips out complex database/boilerplate setups, uses highly accessible phrasing, and formats milestones as gentle, step-by-step guidance to prevent user fatigue.

---

## 3. Frontend Implementation Details

### Node-Graph Visualization
For our node-graph roadmaps, we utilize `@xyflow/react`.
- Roadmaps consist of 20–35 custom nodes and 25–40 edges.
- **Progress Tracking:** Active nodes dynamically update color based on their state in `completedNodeIds`.
- **Sizing:** The node graph container utilizes a `ResizeObserver` pattern instead of fixed viewport heights to handle dynamic container or side-menu sizing gracefully.

### Re-validation UX Controls
- **Re-validate State Handling:** Users can re-validate lesson contents on demand. During re-validation, the action button is temporarily disabled with a clean opacity drop, and the `RefreshCw` icon is animated using Tailwind's `animate-spin` utility class to reflect active background evaluation tasks.

### Component Styling
- **Tailwind CSS v4:** Directly integrates modern utility classes for smooth off-black background dark modes, paired with Inter fonts for UI components and Space Grotesk/Mono for data metrics.
- **Pristine Transitions:** Page layout swaps and course panels leverage `@motion/react` layout animations or fade effects to provide modern, fluid transitions.

---

## 4. Cohort & Class-Linking Clone Workflows

The platform avoids over-complicating user data states by utilizing a pristine, highly-isolated "Clone-on-Join" pattern:

1. **Skeleton Cloning:** When a student joins a class or cohort via invite code, the master curriculum is retrieved. The system clones only the metadata structure (title, roadmapData, difficulty details) into a new table row, assigning ownership to the student with a `clonedFromCourseId` or `clonedFromRoadmapId` tag.
2. **Dynamic Metrics Isolation:** Roster analytics and leaderboards calculate student achievements by filtering active courses and weak topics using these cloned-origin IDs. This keeps the student's personal studies isolated from peers while enabling accurate, scoped leaderboard scoring.
3. **Lazy Lesson Construction:** To keep database reads optimal and allow personalized lesson lengths, lesson markdown files are not copied during cloning. Instead, lessons are lazily generated by the Lesson Agent when the student actively clicks to study that module.
4. **Safety & Deletion Flow:** Creators/teachers retain full structural control over their cohorts. A secure `deleteCohort` procedure validates user ownership before execution, leveraging standard cascading constraints to clean up membership registries automatically.
5. **Preventative UX Controls:** Invite-code previews compute an `isAlreadyMember` flag to disable redundant registration, shifting join triggers into a secure "Already Joined in Cohort" indicator. Attempting duplicate joins programmatically will reject the mutation with a clear `CONFLICT` error.
6. **Leave Cohort Flow:** Normal cohort members (non-owners) have access to a clean "Leave Cohort" toggle/button on their Cohorts Dashboard. Triggering this calls `leaveCohort` to cleanly detach their membership from the cohort leaderboard while retaining their cloned course materials in their private profile. Owners cannot leave their own cohorts but can delete them entirely.

---

## 5. Security & CSP Configuration Enhancements

To reinforce cross-origin security and provide support for "Bring Your Own API Key" user flows:

1. **Strict CORS Policy Validation:** The CORS handler verifies incoming origins strictly against `ALLOWED_ORIGINS` or local debug endpoints. Suffix wildcard rules permitting any origin ending with `*.run.app` have been removed to prevent credentialed cross-origin attacks from neighboring Cloud Run container hosts.
2. **Custom Content Security Policy (CSP):** The express-side Helmet configuration adds `https://generativelanguage.googleapis.com` to the `connect-src` whitelist. This allows direct client-side requests to the Google Gemini API when a user inputs their custom key, resolving browser-level script blockages.

