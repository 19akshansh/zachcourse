import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateText, generateObject, tool, isStepCount } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./src/lib/auth";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, createContext } from "./src/server/trpc";
import { prisma } from "./src/lib/db";

const app = express();
app.set("trust proxy", true);
const PORT = 3000;

// Server-side Google provider using env key
const serverGoogle = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

// Helper to get a model — easy to swap
const getServerModel = (modelId = "gemini-3.5-flash") => 
  serverGoogle(modelId);

app.use(helmet({
  contentSecurityPolicy: false, // disabled so Vite SPA works
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP across all AI routes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Please wait a moment." },
  keyGenerator: (req) => 
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() 
    || req.socket.remoteAddress 
    || "unknown",
});

app.use("/api/generate-roadmap", aiRateLimit);
app.use("/api/generate-lesson", aiRateLimit);
app.use("/api/generate-quiz", aiRateLimit);
app.use("/api/mentor-chat", aiRateLimit);

// Check for duplicate email before registering to prevent silent redirects on duplicate signup
app.post("/api/auth/sign-up/email", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      });
      if (existing) {
        return res.status(422).json({
          error: {
            message: "USER_ALREADY_EXISTS: An account with this email already exists.",
            code: "USER_ALREADY_EXISTS",
            status: 422
          }
        });
      }
    }
  } catch (err) {
    console.error("Error in signup middleware check:", err);
  }
  next();
});

// Mount Better Auth handler
app.all("/api/auth/*", toNodeHandler(auth));

// Mount tRPC express middleware
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// In-memory simple store for simulated session progress & active roadmaps
interface Roadmap {
  title: string;
  description: string;
  difficulty: string;
  modules: {
    id: string;
    title: string;
    description: string;
    lessons: {
      id: string;
      title: string;
      duration: string;
      concepts: string[];
    }[];
  }[];
}

const roadmapsStore: Record<string, Roadmap> = {};
const progressStore: Record<string, { completedLessons: string[]; completedQuizzes: Record<string, number> }> = {};

// Helper for sleep/delay during backoff
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Highly robust wrapper for calling Gemini API with exponential backoff and model/local fallbacks
async function callAI(
  prompt: string,
  options: { json?: boolean; schema?: z.ZodType<any>, systemPrompt?: string, messages?: { role: "system" | "user" | "assistant", content: string }[] } = {}
): Promise<any> {
  const models = [
    "gemini-3.5-flash",
    "gemini-2.5-flash", 
    "gemini-2.5-pro"
  ];
  
  for (const modelId of models) {
    try {
      const model = serverGoogle(modelId);
      
      if (options.schema) {
        const { object } = await generateObject({
          model,
          prompt,
          schema: options.schema,
        });
        return object;
      }
      
      const config: any = {
        model,
        system: options.systemPrompt,
      };
      if (options.messages) {
        config.messages = options.messages;
      } else {
        config.prompt = prompt;
      }
      const { text } = await generateText(config);
      return text;
      
    } catch (err: any) {
      const msg = err?.message || "";
      const isRetryable = 
        msg.includes("503") || 
        msg.includes("429") || 
        msg.includes("overloaded") ||
        msg.includes("quota") ||
        msg.includes("high demand");
      
      console.error(`Model ${modelId} failed:`, msg);
      if (!isRetryable) break;
      await sleep(1500);
    }
  }
  
  return null; // caller handles fallback
}

// Local fallback content generator for roadmaps
function getLocalFallbackRoadmap(topic: string, sourceUrl?: string, textContent?: string): Roadmap {
  const cleanTopic = (topic || "Personalized Skills").trim();
  return {
    title: `Mastering ${cleanTopic}`,
    description: `A beautiful, step-by-step personalized learning path to mastering ${cleanTopic}, prepared by your companion coach to guide you from foundational principles to creative practice.`,
    difficulty: "Beginner Friendly",
    modules: [
      {
        id: "m1_basics",
        title: "Step 1: Foundational Core & Mechanics",
        description: `Get comfortable with the basic building blocks and central ideas behind ${cleanTopic}.`,
        lessons: [
          {
            id: "m1_l1_intro",
            title: `Introduction & Setting the Stage for ${cleanTopic}`,
            duration: "15 mins",
            concepts: ["Core definitions", "First steps", "Why it matters"]
          },
          {
            id: "m1_l2_building",
            title: "Working with Core Concepts",
            duration: "20 mins",
            concepts: ["Main mechanics", "Simple structures", "Hands-on exploration"]
          }
        ]
      },
      {
        id: "m2_intermediate",
        title: "Step 2: Practical Application",
        description: `Apply your knowledge to solve real-world challenges and design interactive solutions.`,
        lessons: [
          {
            id: "m2_l1_patterns",
            title: "Common Patterns & Best Practices",
            duration: "20 mins",
            concepts: ["Design patterns", "Avoiding common pitfalls", "Organizing your ideas"]
          },
          {
            id: "m2_l2_tools",
            title: "Utilizing Tools and Extensions",
            duration: "25 mins",
            concepts: ["Expanding capabilities", "Streamlining workflows", "Creative exercises"]
          }
        ]
      },
      {
        id: "m3_advanced",
        title: "Step 3: Advanced Horizons & Mastery",
        description: `Deepen your mastery and explore advanced techniques to bring your creations to life.`,
        lessons: [
          {
            id: "m3_l1_deployment",
            title: "Perfecting & Launching Your Work",
            duration: "20 mins",
            concepts: ["Refining results", "Sharing with others", "Future directions"]
          },
          {
            id: "m3_l2_mastery",
            title: "Continuous Learning & Next Steps",
            duration: "15 mins",
            concepts: ["Mastery check", "Resource exploration", "Final project showcase"]
          }
        ]
      }
    ]
  };
}

// Local fallback content generator for lessons
function getLocalFallbackLesson(lessonTitle: string, concepts: string[]): string {
  const conceptList = concepts && concepts.length > 0 ? concepts : ["Foundational Ideas", "Application Principles"];
  return `### Study Guide: ${lessonTitle} 📚

Welcome to this tailored study guide! While our live AI server is experiencing temporary high demand, your companion tutor has formulated this high-quality learning reference for you so that you can continue your study adventure without interruption.

---

### 1. **Introduction** 💡

Every great skill starts with a clear map of the territory. Understanding **${lessonTitle}** is like learning to cook with fresh ingredients—once you grasp how the flavors combine, you can create anything from scratch!

To make this intuitive, think of this concept like **a postal delivery system**:
- Instead of carrying letters across the country yourself, you place them in a mailbox.
- The mail carriers route the letters, sort them, and deliver them to the exact destinations.
- This represents how we pass and delegate instructions smoothly, without blocking our primary day-to-day operations.

---

### 2. **Detailed Breakdown** 🔍

Let's dive deep into the core elements:

${conceptList.map((concept, index) => `#### 🌟 **Element ${index + 1}: ${concept}**
- **What it is**: The fundamental mechanism that allows us to manage ${concept.toLowerCase()} with elegance and predictability.
- **Why it matters**: Without this, systems become disorganized, hard to debug, and prone to silent errors. By isolating and mastering this concept, you build an ironclad foundation.`).join("\n\n")}

---

### 3. **Interactive Code & Examples** 🛠️

Here is a practical, clear example showing how these concepts come together:

\`\`\`typescript
// A clean, predictable example demonstrating ${lessonTitle}
function practiceSample() {
  const activeConcepts = ${JSON.stringify(conceptList)};
  console.log("🚀 Initializing practice session...");
  
  for (const concept of activeConcepts) {
    console.log(\`✨ Reviewing active block: \${concept}\`);
    // Master each building block step-by-step
  }
  
  console.log("🎉 Review session complete!");
  return true;
}

practiceSample();
\`\`\`

---

### 4. **Summary & Key Takeaways** 📈

- **Takeaway 1**: Master the individual blocks (${conceptList.slice(0, 2).join(" & ")}) before attempting to build complex systems.
- **Takeaway 2**: Always rely on clear, descriptive names and simple logic structures.
- **Takeaway 3**: Mistakes are just stepping stones. Test small parts frequently to build robust intuition!`;
}

// Local fallback content generator for quizzes
function getLocalFallbackQuiz(lessonTitle: string, concepts: string[]) {
  const concept1 = concepts?.[0] || "Foundations";
  const concept2 = concepts?.[1] || "Core Concepts";
  return {
    questions: [
      {
        id: "fq1",
        question: `What is the primary key behind mastering: "${lessonTitle}"?`,
        options: [
          `Connecting concepts back to your real-world goals, focusing on ${concept1}`,
          "Memorizing syntax structures line-by-line without understanding",
          "Skipping practice entirely to rush to the next step",
          "Writing incredibly long and complex code blocks on the first day"
        ],
        correctIndex: 0,
        explanation: `Focusing on ${concept1} and connecting it to real-world scenarios is the most effective way to develop a deep, intuitive understanding.`
      },
      {
        id: "fq2",
        question: `Why is active practice so important when learning about: "${concept2}"?`,
        options: [
          "It satisfies background system telemetry and logging metrics",
          "It builds strong mental pathways and lets you learn from mistake reflections",
          "It is the only way to avoid computer errors completely",
          "It lets you bypass study guidelines entirely"
        ],
        correctIndex: 1,
        explanation: "Active practice, hands-on experimentation, and reviewing mistakes are the most vital parts of the human learning process!"
      },
      {
        id: "fq3",
        question: "When encountering a difficult topic or complex error, what is the best strategy?",
        options: [
          "Giving up immediately and choosing a different topic",
          "Ignoring the error and hoping it goes away",
          "Breaking the challenge down into smaller, bite-sized components and consulting your mentor",
          "Copying and pasting random code solutions without reading them"
        ],
        correctIndex: 2,
        explanation: "Breaking complex issues into simpler, manageable pieces is the ultimate problem-solving superpower!"
      }
    ]
  };
}

// Local fallback content generator for mentor replies
function getLocalFallbackMentorReply(message: string, currentCourseTitle: string, currentLessonTitle?: string): string {
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes("analogy") || msgLower.includes("explain") || msgLower.includes("how does") || msgLower.includes("why")) {
    return `### Let's look at this with an intuitive analogy! 💡

Think of **${currentLessonTitle || "this concept"}** like a **busy kitchen in a popular restaurant**:
- The **chef** represents your core execution loop—making sure everything is prepared.
- If the chef had to personally wash every plate, greet every guest, and deliver every order, the kitchen would grind to a halt. This is like a single-threaded program blocking on operations.
- Instead, the chef delegates tasks to the **dishwashers, servers, and hosts**. They all work together, allowing the chef to focus purely on cooking delicious meals.

In the same way, breaking your goals into modular, digestible pieces makes learning and building incredibly smooth! Does this analogy help clarify how we think about structure in **${currentCourseTitle}**? Let me know what specific part you'd like to dive into next! 🌟`;
  }
  
  if (msgLower.includes("project") || msgLower.includes("practice") || msgLower.includes("build") || msgLower.includes("exercise")) {
    return `### Here is a fun, hands-on mini-project to practice! 🛠️

Since you're exploring **${currentLessonTitle || currentCourseTitle}**, let's build a **"Personal Hobby Tracker"**!

#### 📋 The Challenge:
Create a simple utility that logs your daily progress in your favorite hobby (coding, reading, drawing, etc.).

#### 🔧 Functional Requirements:
1. Allow the user to input a new activity description.
2. Store a cumulative count of hours or minutes spent.
3. Display a small, encouraging greeting card when they reach a milestone (like 5 hours!).

This project is fantastic because it lets you practice variables, list collections, and basic user interactions! Would you like me to help you outline the step-by-step code structure for this? 🚀`;
  }

  return `### Hello! I'm here for you! 🧑‍🏫

I would love to help you explore more about **${currentCourseTitle}** ${currentLessonTitle ? `(specifically focusing on **${currentLessonTitle}**)` : ""}.

*Note: Our live AI model is currently experiencing high demand, but I've activated my warm local tutoring mode so we don't skip a beat!*

To help me give you the best guidance, tell me a little more:
1. Are you working on a specific challenge right now?
2. Would you like a simpler breakdown of a term?
3. Or would you like to brainstorm a fun coding exercise?

I'm super excited to keep learning together! What's on your mind? 💫`;
}

// 1. API: Generate Roadmap
app.post("/api/generate-roadmap", async (req, res) => {
  const { topic, sourceUrl, textContent } = req.body;
  if (topic && topic.length > 500) {
    res.status(400).json({ error: "Topic too long. Max 500 characters." });
    return;
  }
  if (textContent && textContent.length > 10000) {
    res.status(400).json({ error: "Text content too long. Max 10000 characters." });
    return;
  }
  try {
    if (!topic && !sourceUrl && !textContent) {
      res.status(400).json({ error: "Missing topic, url, or content." });
      return;
    }

    const experienceLevel = req.body.experienceLevel || "beginner";
    const weeklyHours = req.body.weeklyHours || 5;

    const schema = z.object({
      title: z.string(),
      description: z.string(),
      difficulty: z.string(),
      totalDuration: z.string().optional(),
      prerequisites: z.array(z.string()).default([]),
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
    });

    const prompt = `You are an expert curriculum designer.
Create a personalized learning roadmap for:
Topic: ${topic}
Experience level: ${experienceLevel}
Hours per week: ${weeklyHours}
${sourceUrl ? "Reference URL: " + sourceUrl : ""}
${textContent ? "Syllabus: " + textContent : ""}

Rules:
- 3-5 modules, each with 3-5 lessons
- Progressive difficulty
- Last lesson must be a hands-on project
- First lesson completable in under 30 min
- Adapt depth to experience level`;

    const roadmapData = await callAI(prompt, { schema })
      ?? getLocalFallbackRoadmap(topic || "Technology Mastery", sourceUrl, textContent);
    
    const key = topic || "custom_course_" + Date.now();
    roadmapsStore[key] = roadmapData;
    progressStore[key] = { completedLessons: [], completedQuizzes: {} };

    res.json({ roadmapKey: key, roadmap: roadmapData });
  } catch (error: any) {
    console.error("Error generating roadmap:", error);
    res.status(500).json({ error: error.message || "Failed to generate roadmap" });
  }
});

// 2. API: Generate Study Guide Content
app.post("/api/generate-lesson", async (req, res) => {
  const { roadmapKey, moduleId, lessonId, lessonTitle, concepts } = req.body;
  try {
    if (!lessonTitle) {
      res.status(400).json({ error: "Missing lessonTitle" });
      return;
    }

    const prompt = `You are an expert tutor. Write a complete, 
engaging study guide for:
Lesson: "${lessonTitle}"
Concepts: ${JSON.stringify(concepts || [])}

Format in Markdown with sections:
1. Introduction (with real-world analogy)
2. Deep Dive (explain each concept clearly)
3. Code Example (working, annotated code)
4. Key Takeaways (bullet points)

Be thorough, friendly, and practical.`;

    const contentText = await callAI(prompt)
      ?? getLocalFallbackLesson(lessonTitle, concepts);

    res.json({ content: contentText });
  } catch (error: any) {
    console.error("Error generating lesson content:", error);
    res.status(500).json({ error: error.message || "Failed to generate lesson content" });
  }
});

// 3. API: Generate Quiz
app.post("/api/generate-quiz", async (req, res) => {
  const { lessonTitle, lessonContent } = req.body;
  try {
    if (!lessonTitle) {
      res.status(400).json({ error: "Missing lessonTitle" });
      return;
    }

    const schema = z.object({
      questions: z.array(z.object({
        id: z.string(),
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctIndex: z.number().min(0).max(3),
        explanation: z.string(),
      })).length(3)
    });

    const prompt = `Generate exactly 3 multiple-choice quiz 
questions to test understanding of: "${lessonTitle}"
${lessonContent ? "Content summary: " + lessonContent.slice(0, 600) : ""}

Requirements:
- Test understanding not memorization
- 4 options each, only 1 correct
- Include clear explanation for correct answer
- Vary difficulty: 1 easy, 1 medium, 1 hard`;

    const quizData = await callAI(prompt, { schema })
      ?? getLocalFallbackQuiz(lessonTitle, req.body.concepts || []);

    res.json(quizData);
  } catch (error: any) {
    console.error("Error generating quiz:", error);
    res.status(500).json({ error: error.message || "Failed to generate quiz" });
  }
});

// 4. API: Ask Mentor Chat
app.post("/api/mentor-chat", async (req, res) => {
  try {
    const { 
      message, 
      history, 
      currentCourseTitle, 
      currentLessonTitle 
    } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message is required." });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: "Message too long. Max 2000 characters." });
      return;
    }
    if (history && history.length > 20) {
      res.status(400).json({ error: "History too long." });
      return;
    }

    // Check if user passed their own key
    const userKey = req.headers["x-user-key"] as string | undefined;
    const googleClient = userKey ? createGoogleGenerativeAI({ apiKey: userKey }) : serverGoogle;
    const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-pro"];
    let text: string | undefined;

    for (const modelId of models) {
      try {
        const model = googleClient(modelId);

        const result = await generateText({
          model,
          
          system: `You are ZachCourse Assistant — a brilliant, warm, highly knowledgeable AI mentor.

PRIMARY FOCUS: Help the student with "${currentCourseTitle || 'General Learning'}"
${currentLessonTitle ? `Current lesson: "${currentLessonTitle}"` : ""}

TOOLS AVAILABLE:
- fetchUrl: Call this EVERY TIME the user shares any URL (http:// or https://). Never skip this.
- searchWeb: Call this for anything current, recent, or version-specific.

STRICT RULES — NEVER BREAK THESE:
1. User shares a URL → call fetchUrl immediately, no exceptions.
2. fetchUrl returns success:false → tell the user the page blocked access, then answer from your training knowledge about that topic.
3. fetchUrl returns success:true → summarize the content clearly and relate it to the course.
4. You MUST always produce a helpful text response. Never return empty output.
5. If every tool fails → acknowledge it briefly, then answer from what you know.
6. Never say "I couldn't generate a response" — that is a forbidden output.

TEACHING STYLE:
- For concepts: definition → analogy → example
- For errors: diagnose → fix steps → 💡 pro tip
- Use markdown formatting with headers and code blocks`,

      messages: [
        ...(history || []).slice(-8).map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user" as const,
          content: m.content || m.text || "",
        })),
        { role: "user" as const, content: message }
      ],

      tools: {
        fetchUrl: tool({
          description: "Fetch and read the content of any URL. " +
            "Use this whenever the user shares a link or asks " +
            "about a specific webpage, documentation, competition, " +
            "article, or any online resource. Always use this " +
            "before answering questions about URLs.",
          inputSchema: z.object({
            url: z.string().url().describe(
              "The full URL to fetch including https://"
            ),
            reason: z.string().describe(
              "Why you are fetching this URL"
            ),
          }),
          execute: async ({ url, reason }: { url: string, reason: string }) => {
            try {
              // Block internal/private network requests (SSRF protection)
              const parsedUrl = new URL(url);
              const blockedHosts = [
                "169.254.169.254", // AWS/GCP metadata
                "metadata.google.internal",
                "localhost",
                "127.0.0.1",
                "0.0.0.0",
                "::1",
              ];
              const isPrivateIp = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsedUrl.hostname);
              if (blockedHosts.includes(parsedUrl.hostname) || isPrivateIp) {
                return {
                  success: false,
                  error: "Blocked: internal network access not allowed",
                  content: "",
                  title: "",
                  url,
                };
              }
              if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                return {
                  success: false,
                  error: "Blocked: only http/https URLs allowed",
                  content: "",
                  title: "",
                  url,
                };
              }

              const response = await fetch(url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; ZachCourse/1.0)",
                  "Accept": "text/html,text/plain",
                },
                signal: AbortSignal.timeout(8000),
              })

              if (!response.ok) {
                return { 
                  success: false, 
                  error: `HTTP ${response.status}`,
                  content: "",
                  title: "",
                  url 
                }
              }

              const raw = await response.text()
              
              // Clean HTML to readable text
              const clean = raw
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<nav[\s\S]*?<\/nav>/gi, "")
                .replace(/<footer[\s\S]*?<\/footer>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&nbsp;/g, " ")
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/\s{3,}/g, "\n\n")
                .trim()
                .slice(0, 8000) // Limit context size

              const titleMatch = raw.match(/<title[^>]*>(.*?)<\/title>/i)
              const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || ""

              return { 
                success: true, 
                title,
                content: clean,
                url,
                error: ""
              }
            } catch (err: any) {
              return { 
                success: false, 
                error: String(err.message),
                content: "",
                title: "",
                url 
              }
            }
          },
        }),

        searchWeb: tool({
          description: "Search the web for current information, " +
            "recent news, latest documentation, or anything that " +
            "might have changed recently. Use when the user asks " +
            "about current events, latest versions, or recent updates.",
          inputSchema: z.object({
            query: z.string().describe("The search query"),
          }),
          execute: async ({ query }: { query: string }) => {
            // Use DuckDuckGo instant answer API (free, no key needed)
            try {
              const encoded = encodeURIComponent(query)
              const res = await fetch(
                `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
                { signal: AbortSignal.timeout(5000) }
              )
              const data = await res.json()
              
              const results = [
                data.AbstractText && `Summary: ${String(data.AbstractText)}`,
                ...(data.RelatedTopics || [])
                  .slice(0, 4)
                  .map((t: any) => String(t.Text))
                  .filter(Boolean)
              ].filter(Boolean).join("\n\n")

              return { 
                query,
                results: results || "No results found",
                source: String(data.AbstractURL || "DuckDuckGo")
              }
            } catch (err: any) {
              return { 
                query, 
                results: "Search failed: " + String(err.message),
                source: ""
              }
            }
          },
        }),
      },

      // Let the agent loop up to 5 times 
      // (fetch URL → read result → answer)
      stopWhen: isStepCount(5),
    });

        text = result.text;
        break; // Success
      } catch (err: any) {
        const msg = err?.message || "";
        const isRetryable = 
          msg.includes("503") || 
          msg.includes("429") || 
          msg.includes("overloaded") ||
          msg.includes("quota") ||
          msg.includes("high demand") ||
          msg.includes("unavailable");
        
        console.error(`Model ${modelId} failed in mentor chat:`, msg);
        if (!isRetryable) {
          throw err;
        }
        await sleep(1500); // Wait before trying next model
      }
    }

    if (text === undefined) {
      throw new Error("All AI models are currently experiencing very high demand. Please try again in a few moments.");
    }

    const reply = text?.trim();
    res.json({
      reply: reply ||
        "I ran into an issue processing that. Try rephrasing, or paste the page content directly into chat and I'll work with it.",
    });

  } catch (err: any) {
    console.error("[mentor-chat] error:", err)
    const msg = err.message || "";
    
    // If it's a model overloading or quota error, return a friendly message directly as the reply.
    if (msg.includes("high demand") || msg.includes("overloaded") || msg.includes("quota") || msg.includes("429") || msg.includes("503")) {
      return res.json({
        reply: "The AI is currently experiencing very high demand. Spikes in demand are usually temporary, please try again in a few moments."
      });
    }
    
    res.status(500).json({ 
      error: err.message || "Mentor failed to respond" 
    })
  }
});

// Express API for GitHub Star verification
app.get("/api/verify-star", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session || !session.user) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Please sign in first." });
      return;
    }

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github"
      }
    });

    if (!account || !account.accessToken) {
      res.status(400).json({ error: "NO_GITHUB_ACCOUNT", message: "No connected GitHub account found." });
      return;
    }

    const githubRes = await fetch("https://api.github.com/user/starred/19akshansh/zachcourse", {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ZachCourse-App"
      }
    });

    if (githubRes.status === 204) {
      res.json({ starred: true });
    } else {
      res.json({ starred: false, status: githubRes.status });
    }
  } catch (error: any) {
    console.error("Error in verify-star API:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// IP Rate limiting for Express /api/ai proxy (max 3 requests per minute per IP)
const expressIpLimitMap = new Map<string, { count: number; resetTime: number }>();

function isExpressRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60000;
  const limitInfo = expressIpLimitMap.get(ip);

  if (!limitInfo || now > limitInfo.resetTime) {
    expressIpLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (limitInfo.count >= 3) {
    return true;
  }

  limitInfo.count += 1;
  return false;
}

app.post("/api/ai", async (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString();

  if (isExpressRateLimited(clientIp)) {
    res.status(429).json({ error: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Max 3 requests per minute." });
    return;
  }

  try {
    const cookies = req.headers.cookie || "";
    
    const starMatch = cookies.match(/(?:^|; )zc_star_bonus=([^;]*)/);
    const starBonus = starMatch ? parseInt(starMatch[1], 10) || 0 : 0;

    const { prompt, systemPrompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(500).json({ error: "SERVER_CONFIGURATION_ERROR", message: "Gemini API key is not configured." });
      return;
    }

    const text = await callAI(prompt, { systemPrompt });
    res.json({ reply: text || "" });
  } catch (error: any) {
    console.error("Error in Express /api/ai proxy:", error);
    res.status(500).json({ error: error.message || "Failed to call AI API" });
  }
});

// Start dev server / static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
