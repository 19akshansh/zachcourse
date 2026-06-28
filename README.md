<div align="center">
  <h1>🎓 ZachCourse</h1>
  <p>A multi-agent AI learning companion that turns any topic into a personalized, interactive course.</p>
  <a href="https://ais-dev-fg6nnldzwvuyvu3rsspevg-53963441605.asia-east1.run.app">
    <img src="https://img.shields.io/badge/Live-Demo-brightgreen.svg" alt="Live Demo" />
  </a>
  <a href="https://github.com/19akshansh/zachcourse/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
  </a>
</div>

## ✨ What It Does

- **Dynamic Curriculums:** Paste a URL, topic, or raw text, and ZachCourse instantly generates a structured, week-by-week learning roadmap.
- **Tireless AI Mentor:** Chat with a persistent tutor that remembers your progress, reads external links, and answers questions 24/7.
- **Adaptive Assessments:** Test your knowledge with on-the-fly multiple-choice quizzes tailored to your current lesson.
- **Real Persistence:** All courses, chat histories, and quiz scores are saved securely so you can pick up exactly where you left off.

## 🤖 The Agent System

ZachCourse is powered by a team of specialized AI agents working together:

- **Roadmap Agent:** Uses structured output generation to instantly design complete curriculums from messy inputs or simple topics.
- **Mentor Agent:** Operates in an agentic loop with custom tools (web search, URL fetching) to act as a highly contextual, interactive tutor.
- **Quiz Agent:** Generates lesson-specific, adaptive quizzes on demand to validate your understanding.
- **Progress Agent:** Maintains long-term memory, tracking your streaks, completed modules, and chat history across sessions.

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | Vite, React 19, Tailwind CSS v4 |
| **Backend** | Express.js, tRPC v11 |
| **AI & Agents** | Vercel AI SDK v7, `@ai-sdk/google`, Gemini 2.5 Flash |
| **Database & ORM** | NeonDB (PostgreSQL), Prisma |
| **Authentication** | Better Auth |

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/19akshansh/zachcourse.git
   cd zachcourse
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:**
   Create a `.env` file in the root directory and configure the variables listed in the section below.
4. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   ```
5. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🔑 Environment Variables

| Variable | Description | Required |
| :--- | :--- | :--- |
| `DATABASE_URL` | NeonDB connection string for Prisma | Yes |
| `DIRECT_URL` | Direct connection string for NeonDB | Yes |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth sessions | Yes |
| `BETTER_AUTH_URL` | Base URL for auth (e.g., http://localhost:3000) | Yes |
| `APP_URL` | Application base URL | Yes |
| `VITE_APP_URL` | Application base URL for Vite client | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | No (for GitHub auth) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | No (for GitHub auth) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | No (for Google auth) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | No (for Google auth) |
| `EMAIL_HOST` | SMTP host for email sending | No (for email magic links) |
| `EMAIL_PORT` | SMTP port | No |
| `EMAIL_USER` | SMTP user | No |
| `EMAIL_PASS` | SMTP password | No |
| `EMAIL_FROM` | Sender email address | No |
| `GEMINI_API_KEY` | Google Gemini API Key | Yes |

## 🏗️ Architecture

```text
User 
  │
  ▼
React SPA (Vite + Tailwind)
  │
  ▼ (tRPC)
Express Backend
  │
  ├─► Roadmap Agent (generateObject)
  ├─► Mentor Agent (Agentic Loop + Tools)
  ├─► Quiz Agent (generateObject)
  ├─► Progress Agent (Memory Management)
  │
  ▼
NeonDB (PostgreSQL via Prisma)
```

## 📸 Screenshots

![Dashboard Placeholder](#)
*Dashboard: View all your active courses and daily streaks.*

![Roadmap View Placeholder](#)
*Roadmap View: Navigate through dynamically generated, structured modules.*

![Mentor Chat Placeholder](#)
*Mentor Chat: Interact with your AI tutor in a persistent, context-aware environment.*

## 🏆 Built For

Created for the **Google x Kaggle 5-Day AI Agents Intensive Vibe Coding Capstone 2026** under the **Agents for Good (Education)** track.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
