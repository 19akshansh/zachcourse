# ZachCourse: An AI-Powered Personalized Learning Platform

> **Capstone Submission -- Google AI Studio Vibe Coding Agents Course**

## Problem

Traditional online learning platforms provide static curricula that rarely adapt to an individual learner's background, pace, or goals. Learners often spend significant time searching across documentation, videos, and forums whenever they encounter a difficult concept, interrupting their learning flow. ZachCourse addresses this challenge by combining curriculum generation, lesson authoring, assessment, and tutoring into a unified AI-assisted learning experience.

## Solution Overview

ZachCourse generates personalized learning roadmaps from natural-language goals, produces lesson content on demand, creates quizzes for self-assessment, and offers contextual tutoring throughout the learning journey. Instead of shipping a fixed catalog of courses, the application creates learning experiences dynamically based on each learner's objectives.

The project was built using an AI-assisted development workflow with Google AI Studio. AI accelerated component generation, interface refinement, prompt iteration, and debugging, while architectural decisions, validation, and testing remained developer-driven.

## Technical Architecture

The application follows a client-server architecture.

-   **Frontend:** React with Vite and Tailwind CSS for a responsive interface.
-   **Backend:** Express and tRPC expose AI-powered endpoints while keeping model credentials off the client.
-   **Authentication:** Better Auth manages user authentication.
-   **Database:** Prisma with PostgreSQL stores user progress and generated learning artifacts.
-   **LLM:** Gemini 2.5 Flash powers roadmap generation, lesson creation, quizzes, and tutoring.
-   **Markdown Rendering:** Generated lessons support rich Markdown formatting.

Rather than relying on one large prompt, the system separates responsibilities into specialized workflows, improving maintainability and output consistency.

![System Overview](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2Fa6d542683ac334cb9e37c56967a54acb%2Fzachcourse_system_overview_branded.svg?generation=1782887338712365&alt=media)
![User Journey](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F502e3794f6f00283d7c724e1648c6f36%2Fzachcourse_user_journey_branded.svg?generation=1782887367908912&alt=media)
![Tech Stack](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F79a600e51dd3972d441d66f3eb9dc43d%2Fzachcourse_tech_stack_branded.svg?generation=1782887421630954&alt=media)
![System Architecture](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F29564831%2F6a0701a4119b213b52540e3e1dcf19b1%2Fzachcourse_architecture_fixed.svg?generation=1782887444798891&alt=media)

## Agent Design

The application uses multiple specialized AI roles:

-   Curriculum generation
-   Lesson generation
-   Quiz generation
-   Context-aware tutoring

Each workflow receives only the context required for its task. This reduces prompt complexity, improves consistency, and lowers token usage. The tutoring workflow also receives the learner's current lesson context so responses remain focused on the active topic instead of drifting into unrelated explanations.

## Development Process

Google AI Studio significantly accelerated development. Instead of manually implementing every interface from scratch, development became an iterative loop:

1.  Describe desired functionality.
2.  Generate an initial implementation.
3.  Review generated code.
4.  Test manually.
5.  Refine prompts.
6.  Repeat until requirements were satisfied.

This approach reduced time spent on boilerplate while allowing more effort to be invested in system architecture, prompt engineering, and user experience.

## Evaluation

Evaluation focused on functional correctness rather than benchmark
scores.

Testing included:

-   roadmap generation for multiple subjects
-   lesson generation quality
-   quiz consistency
-   conversational tutoring
-   responsive layouts
-   malformed user input
-   JSON parsing reliability
-   authentication flow

The project was refined through repeated prompt iteration and manual testing until generated outputs were consistently usable.

## Responsible AI

The application incorporates several safeguards:

-   authenticated access to AI functionality
-   server-side model orchestration
-   limited conversational context
-   structured outputs where appropriate
-   validation before rendering generated content

These measures improve reliability while reducing opportunities for
prompt misuse and malformed outputs.

## Challenges and Trade-offs

Several engineering decisions required balancing capability with simplicity.

Passing large amounts of lesson content to every AI request improved context but increased latency and token consumption. Restricting prompts to the most relevant information produced faster responses while maintaining quality.

Similarly, separating functionality into multiple specialized workflows increased implementation complexity but resulted in more predictable outputs than using a single monolithic prompt.

## Lessons Learned

Building ZachCourse reinforced several ideas:

-   Prompt engineering is a software design activity rather than simply writing better instructions.
-   Reliable AI applications require validation, defensive programming, and iterative testing.
-   Smaller, specialized AI workflows are easier to maintain than one highly complex prompt.
-   Human review remains essential throughout AI-assisted software development.

## Future Work

Planned improvements include:

-   retrieval-augmented generation for uploaded learning resources
-   semantic long-term learner memory
-   richer analytics and progress tracking
-   automated evaluation pipelines
-   improved observability
-   collaborative multi-agent review of generated lessons

## Conclusion

ZachCourse demonstrates how modern AI models can support personalized education beyond simple question answering. By combining roadmap generation, lesson authoring, assessment, and contextual tutoring within a cohesive application, the project showcases practical agent orchestration and an AI-assisted development workflow. The experience highlighted both the strengths and limitations of current language models while emphasizing the importance of thoughtful architecture, prompt iteration, and human oversight in building reliable AI applications.

------------------------------------------------------------------------
# 🎓 ZachCourse

**A multi-agent AI learning companion that turns any topic into a personalized, interactive course.**

## ✨ What It Does

-   **Dynamic Curriculums:** Paste a URL, topic, or raw text, and ZachCourse instantly generates a structured, week-by-week learning roadmap.
-   **Tireless AI Mentor:** Chat with a persistent tutor that remembers your progress, reads external links, and answers questions 24/7.
-   **Adaptive Assessments:** Test your knowledge with on-the-fly multiple-choice quizzes tailored to your current lesson.
-   **Real Persistence:** All courses, chat histories, and quiz scores are saved securely so you can pick up exactly where you left off.
