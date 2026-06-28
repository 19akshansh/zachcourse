# ZachCourse: A Multi-Agent AI Learning Companion That Actually Finishes Courses With You

## The Problem

Here's something I've never admitted out loud: I have 14 unfinished Udemy courses. I bought them with the best intentions, watched the first two hours, got stuck on something, and then just... stopped. Not because I stopped caring. Because there was nobody to ask.

That's the real issue with online learning — it's designed for consumption, not understanding. You get a video, a transcript, maybe a forum where your question sits unanswered for three days. The model assumes you'll figure it out. Most people don't. Completion rates for MOOCs hover around 5–15%, a number the industry has largely accepted as normal.

I didn't think an AI could fix this. Then I spent this week building one and changed my mind. The difference between a chatbot that "helps with learning" and an actual learning companion is architecture — specifically, whether the system is *stateful*, *specialized*, and *agentic*. A single-prompt chatbot forgets you the moment you close the tab. ZachCourse doesn't. It remembers which lesson you left off on, how you scored on your last quiz, and what you asked your mentor three sessions ago. It treats every course like an ongoing conversation — because that's what learning actually is.

## Why This Needed Agents, Not Just a Chatbot

The first version I imagined was a simple chatbot wrapper. You'd describe a topic, get some reading, ask questions. I built a rough version in about two hours. It was useless.

The problem was that learning isn't one task — it's at least four distinct tasks that need to happen in sequence and in parallel: *curriculum design*, *teaching*, *assessment*, and *progress tracking*. Each requires different context, different tools, and different output formats. Trying to do all four in a single prompt produced something that was mediocre at all of them.

The moment I split these into specialized agents with clear responsibilities — and gave the mentor agent actual tools to use — everything changed. The roadmap became structured and navigable. The mentor could actually read the documentation page you pasted. The quiz stopped being generic. And your progress meant something because it persisted in a real database.

Agents are the right solution here because the problem is inherently multi-step, stateful, and requires tool use that a static prompt simply cannot do.

## Meet the Agents

| Agent | Role | Key Capability | Course Concept |
|---|---|---|---|
| **Roadmap Agent** | Curriculum architect | Accepts a URL, topic, or raw syllabus text and generates a structured week-by-week course with modules, lessons, durations, and difficulty levels | Structured output (`generateObject` + Zod schema) |
| **Mentor Agent** | Personal tutor | Maintains conversation history per course, reads any URL the user pastes, searches the web for current information, and loops up to 5 times before responding | Agentic loop (`isStepCount(5)`) + tool use (`fetchUrl`, `searchWeb`) |
| **Quiz Agent** | Knowledge validator | Generates 3 adaptive MCQ questions per lesson on demand, tied to the specific concepts covered, with scores persisted per course | Structured output (`generateObject` + Zod schema) |
| **Progress Agent** | Long-term memory | Tracks completed lessons, quiz scores, streak days, and hours logged across every session — reads from and writes to PostgreSQL via Prisma on every load | Agent memory (NeonDB persistence) |

## How It Actually Works — A Real User Journey

You sign up, paste this URL: `https://www.kaggle.com/competitions/vibecoding-agents-capstone-project`. The Roadmap Agent fetches the structure, identifies this as a software engineering + AI competition, and generates a 4-week curriculum: week one covers AI agent concepts and Vercel AI SDK basics, week two covers tool calling and structured output, week three covers full-stack deployment, week four is a capstone project.

You click into Lesson 1. The mentor's welcome message is already there, personalized to your course. You ask: *"What's the difference between generateText and generateObject?"* The Mentor Agent checks your conversation history (zero messages so far), sees you're in the beginner track, and responds with a definition, an analogy comparing it to asking someone to "talk" vs. asking them to "fill out a form", and a code example. This response is saved to the database. When you come back tomorrow, it's still there.

Three lessons later you paste a link to the Vercel AI SDK docs. The Mentor Agent's `fetchUrl` tool fires automatically — it strips the HTML, extracts the clean text, and the agent reads the actual current documentation instead of hallucinating an outdated version. You finish the lesson, click the quiz button. Three questions appear, specific to what you just covered. You score 2/3. That score is written to your course record.

Four weeks later — or four days if you push hard — you've completed the roadmap. Your progress tab shows your streak, your total hours, your quiz history. It's all there because a Progress Agent was quietly writing every action to Postgres the whole time.

## Technical Architecture

The backend is an Express.js server with tRPC v11 for type-safe API calls between the React frontend and the database. All AI calls go through the Vercel AI SDK v7 (`@ai-sdk/google`) with Gemini as the model provider.

The **Roadmap and Quiz agents** both use `generateObject` with strict Zod schemas — the output is validated at the type level before it ever hits the frontend, which means the UI can trust the structure completely. The **Mentor Agent** uses `generateText` with two registered tools:

- `fetchUrl` — fetches any URL, strips scripts/styles/nav/footer tags, returns clean text up to 8,000 characters
- `searchWeb` — hits the DuckDuckGo instant answer API (no key required) for current information

The agent runs with `stopWhen: isStepCount(5)`, meaning it can call tools, read results, and decide to call more tools before committing to a final response — a real agentic loop, not a single-shot prompt.

All course data, chat history, quiz scores, and progress live in NeonDB (PostgreSQL) accessed via Prisma ORM. Better Auth handles authentication with email/password, Google OAuth, and GitHub OAuth. The frontend is Vite + React 19 + TypeScript with Tailwind CSS v4.

The system includes a model fallback chain — if the primary model is under load, it cascades through alternatives automatically, so users never see a hard failure.

## What Building This Taught Me

I came into this week thinking vibe coding meant "let AI write your code while you supervise." That's not quite it. The real shift is that the design conversation — the *why* and the *how* — happens in natural language now, and the implementation follows from that. I spent more time thinking about agent responsibilities and data flow than I ever have on a project this size. The code almost wrote itself once I had the architecture clear. What used to be the hard part (syntax, boilerplate, API wiring) became fast. What was always the important part (knowing *what* to build and *why*) became the whole job. I think that's the right direction.

---

**Try it:** [zachcourse.vercel.app](to add url)

**Source code:** [github.com/19akshansh/zachcourse](https://github.com/19akshansh/zachcourse)

*Built by Akshansh Srivastav for the Google x Kaggle 5-Day AI Agents Intensive Vibe Coding Capstone 2026 — Agents for Good (Education) track.*
