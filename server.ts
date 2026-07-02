import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import multer from "multer";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { generateText, generateObject, tool, isStepCount, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./src/lib/auth";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, createContext } from "./src/server/trpc";
import { prisma } from "./src/lib/db";
const db = prisma;
import { extractTextFromBuffer, detectPromptInjection } from "./src/lib/document-processor";
import { retrieveRelevantMemories, storeMentorExchange } from "./src/lib/memory";

const app = express();

const ALLOWED_ORIGINS = [
  process.env.VITE_APP_URL,
  process.env.APP_URL,
  process.env.BETTER_AUTH_URL,
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, curl, server-to-server) or sandboxed iframes ("null")
    if (!origin || origin === "null") return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || 
        origin.includes("run.app") ||
        origin.includes("localhost")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,  // CRITICAL — allows cookies to be sent
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization",
    "x-trpc-source",
    "cookie",
  ],
}));

// Handle preflight requests for ALL routes
app.options("*", cors());

app.set("trust proxy", true);
const PORT = 3000;

// Server-side Google provider using env key
const serverGoogle = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

// Helper to get a model — easy to swap
const getServerModel = (modelId = "gemini-2.5-flash") => 
  serverGoogle(modelId);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
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

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
    }
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Please sign in first." });
      return;
    }
    (req as any).user = session.user;
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

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

// Helper for sleep/delay during backoff
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Highly robust wrapper for calling Gemini API with exponential backoff and model/local fallbacks
async function callAI(
  prompt: string,
  options: { json?: boolean; schema?: z.ZodType<any>, systemPrompt?: string, messages?: { role: "system" | "user" | "assistant", content: string }[], apiKey?: string } = {}
): Promise<any> {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro"
  ];
  
  for (const modelId of models) {
    try {
      const googleClient = options.apiKey ? createGoogleGenerativeAI({ apiKey: options.apiKey }) : serverGoogle;
      const model = googleClient(modelId);
      
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
function getLocalFallbackRoadmap(topic: string, sourceUrl?: string, textContent?: string): any {
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

// Memory storage only — never touch disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB per file
    files: 3,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/markdown",
    ];
    const allowedExts = [".pdf", ".txt", ".md"];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowed.includes(file.mimetype) || 
        allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_FILE_TYPE"));
    }
  },
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 5,
  message: { error: "Too many uploads. Try again in an hour." }
});

app.post(
  "/api/process-documents",
  uploadRateLimit,
  requireAuth,
  upload.array("files", 3),
  async (req, res) => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const results: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      const { text, pages, error } = await extractTextFromBuffer(
        file.buffer,
        file.mimetype,
        file.originalname
      );

      if (error === "INJECTION_DETECTED") {
        res.status(400).json({
          error: "This document contains content that cannot be safely processed.",
          file: file.originalname,
        });
        return;
      }

      if (error === "UNSUPPORTED_TYPE") {
        warnings.push(`${file.originalname}: unsupported type`);
        continue;
      }

      if (error === "PARSE_FAILED" || !text) {
        warnings.push(`${file.originalname}: could not parse`);
        continue;
      }

      const pageInfo = pages ? ` (${pages} pages)` : "";
      results.push(`--- Document: ${file.originalname}${pageInfo} ---\n${text}`);
    }

    if (results.length === 0) {
      res.status(422).json({
        error: "No readable content found in uploaded files",
        warnings,
      });
      return;
    }

    // Combine all documents, enforce total cap
    const combined = results.join("\n\n").slice(0, 50_000);

    // Final injection check on combined output
    if (detectPromptInjection(combined)) {
      res.status(400).json({
        error: "Document content failed safety validation."
      });
      return;
    }

    res.json({
      extractedText: combined,
      fileCount: results.length,
      warnings,
      charCount: combined.length,
    });
  }
);

// 1. API: Generate Roadmap
app.post("/api/generate-roadmap", requireAuth, async (req, res) => {
  const { topic, sourceUrl, textContent, documentContext } = req.body;
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

    // Validate documentContext
    const safeDocContext = typeof documentContext === "string"
      ? documentContext.slice(0, 40_000)
      : "";

    const prompt = `You are an expert curriculum designer.
Create a personalized learning roadmap for:
Topic: ${topic}
Experience level: ${experienceLevel}
Hours per week: ${weeklyHours}
${sourceUrl ? "Reference URL: " + sourceUrl : ""}
${textContent ? "Syllabus excerpt: " + textContent.slice(0, 3000) : ""}
${safeDocContext ? `
Reference Document Content (use this as primary source):
<document_context>
${safeDocContext}
</document_context>
Prioritise this document content over general knowledge 
when creating the roadmap. Extract real module names, 
topics, and structure from it where possible.
` : ""}

Rules:
- 3-5 modules, each with 3-5 lessons
- Progressive difficulty
- Last lesson must be a hands-on project
- First lesson completable in under 30 min
- Adapt depth to experience level`;

    let roadmapData = await callAI(prompt, { schema })
      ?? getLocalFallbackRoadmap(topic || "Technology Mastery", sourceUrl, textContent);

    // --- CRITIC AGENT ---
    let reviewMeta = { revised: false, issuesFound: 0 };
    if (roadmapData) {
      const criticSchema = z.object({
        approved: z.boolean(),
        issues: z.array(z.object({
          severity: z.enum(["minor", "major"]),
          location: z.string(),
          problem: z.string(),
          suggestion: z.string(),
        })),
        revisionNotes: z.string().optional(),
      });

      const criticPrompt = `You are an expert curriculum reviewer. Review the following generated roadmap against these criteria:
- Logical lesson ordering and prerequisites
- Appropriate difficulty progression
- No duplicate or overlapping lessons
- Realistic time estimates

Roadmap to review:
${JSON.stringify(roadmapData)}
`;
      const critique = await callAI(criticPrompt, { schema: criticSchema });
      
      if (critique && !critique.approved && critique.revisionNotes) {
        console.log(`[Critic Agent] Roadmap rejected. Issues: ${critique.issues.length}. Retrying...`);
        const revisionPrompt = prompt + `\n\nNOTE: A reviewer evaluated your previous attempt and found the following issues:\n${critique.revisionNotes}\n\nPlease revise the roadmap to address these issues.`;
        
        roadmapData = await callAI(revisionPrompt, { schema }) ?? roadmapData;
        reviewMeta = { revised: true, issuesFound: critique.issues.length };
      } else if (critique) {
        reviewMeta = { revised: false, issuesFound: critique.issues.length };
      }
    }
    
    if (roadmapData) {
      (roadmapData as any)._reviewMeta = reviewMeta;
    }
    // --------------------

    res.json({ roadmap: roadmapData });
  } catch (error: any) {
    console.error("Error generating roadmap:", error);
    res.status(500).json({ error: error.message || "Failed to generate roadmap" });
  }
});

app.post("/api/generate-visual-roadmap", aiRateLimit, async (req, res) => {
  const { topic, experienceLevel, weeklyHours, sourceUrl, documentContext } = req.body
  
  // Validate documentContext
  const safeDocContext = typeof documentContext === "string"
    ? documentContext.slice(0, 40_000)
    : "";

  const schema = z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
    totalDuration: z.string(),
    prerequisites: z.array(z.string()),
    nodes: z.array(z.object({
      id: z.string(),
      type: z.enum([
        "start",
        "module",
        "lesson",
        "milestone",
        "project",
        "end"
      ]),
      label: z.string(),
      description: z.string(),
      duration: z.string().optional(),
      difficulty: z.enum(["Beginner","Intermediate","Advanced"]).optional(),
      concepts: z.array(z.string()).optional(),
      moduleId: z.string().optional(),
      order: z.number(),
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
      label: z.string().optional(),
      type: z.enum(["required","optional","parallel"]),
    })),
  })

  const prompt = `You are a world-class curriculum architect.
Generate a comprehensive visual learning roadmap as a graph.

Topic: "${topic}"
Experience level: ${experienceLevel || "beginner"}
Hours per week: ${weeklyHours || 5}
${sourceUrl ? "Reference: " + sourceUrl : ""}
${safeDocContext ? `
Reference Document Content (use this as primary source):
<document_context>
${safeDocContext}
</document_context>
Prioritise this document content over general knowledge 
when creating the roadmap. Extract real module names, 
topics, and structure from it where possible.
` : ""}

GRAPH STRUCTURE RULES:
1. Start with exactly ONE "start" node (id: "start")
2. Create 3-5 module nodes (id: "module_1", "module_2" etc)
3. Each module has 3-5 lesson nodes 
   (id: "m1_lesson_1", "m1_lesson_2" etc)
4. After each module add a "milestone" node with a 
   mini-project or quiz checkpoint
5. At least 2 "project" nodes (real hands-on builds)
6. End with exactly ONE "end" node (id: "end") 
   labeled "You're Job-Ready! 🎉" or similar
7. Edges define the path:
   - Lessons connect linearly within a module
   - Some lessons can have parallel optional paths
   - Milestones gate the next module
8. Include 2-3 OPTIONAL side-path nodes for "going deeper"
   connected with type: "optional"

CONTENT RULES:
- Every lesson node MUST have: concepts (3-5 terms), 
  duration, difficulty, and 2-3 resources
- Make descriptions specific and actionable
  (not "learn about X" but "build a X that does Y")
- Progressive difficulty: Beginner → Intermediate → Advanced
- First lesson: completable in 20 minutes
- Last project: portfolio-worthy, takes 2-4 hours

Produce a graph with 20-35 total nodes and 25-40 edges.`

  try {
    const userKey = req.headers["x-user-key"] as string | undefined;
    let data = await callAI(prompt, { schema, apiKey: userKey })
    if (!data) {
      res.status(500).json({ error: "Generation failed" })
      return
    }

    // --- CRITIC AGENT ---
    let reviewMeta = { revised: false, issuesFound: 0 };
    const criticSchema = z.object({
      approved: z.boolean(),
      issues: z.array(z.object({
        severity: z.enum(["minor", "major"]),
        location: z.string(),
        problem: z.string(),
        suggestion: z.string(),
      })),
      revisionNotes: z.string().optional(),
    });

    const criticPrompt = `You are an expert curriculum reviewer. Review the following generated visual roadmap graph against these criteria:
- Logical lesson ordering and prerequisites
- Appropriate difficulty progression
- No duplicate or overlapping lessons
- Realistic time estimates
- Valid graph structure: single start/end node, no orphaned nodes, edges reference real node ids.

Visual Roadmap to review:
${JSON.stringify(data)}
`;
    const critique = await callAI(criticPrompt, { schema: criticSchema, apiKey: userKey });
    
    if (critique && !critique.approved && critique.revisionNotes) {
      console.log(`[Critic Agent] Visual Roadmap rejected. Issues: ${critique.issues.length}. Retrying...`);
      const revisionPrompt = prompt + `\n\nNOTE: A reviewer evaluated your previous attempt and found the following issues:\n${critique.revisionNotes}\n\nPlease revise the visual roadmap graph to address these issues.`;
      
      data = await callAI(revisionPrompt, { schema, apiKey: userKey }) ?? data;
      reviewMeta = { revised: true, issuesFound: critique.issues.length };
    } else if (critique) {
      reviewMeta = { revised: false, issuesFound: critique.issues.length };
    }
    
    (data as any)._reviewMeta = reviewMeta;
    // --------------------

    res.json({ roadmap: data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 2. API: Generate Study Guide Content
app.post("/api/generate-lesson", requireAuth, async (req, res) => {
  const { roadmapKey, moduleId, lessonId, lessonTitle, concepts, courseContext, documentContext, courseId } = req.body;
  try {
    if (!lessonTitle) {
      res.status(400).json({ error: "Missing lessonTitle" });
      return;
    }

    const safeDocContext = typeof documentContext === "string"
      ? documentContext.slice(0, 20_000)
      : "";

    const prompt = `You are an expert tutor. Write a complete, 
engaging study guide for:
Lesson: "${lessonTitle}"
Concepts: ${JSON.stringify(concepts || [])}
${safeDocContext ? `
Relevant source material for this lesson:
<document_context>
${safeDocContext}
</document_context>
Draw examples and explanations from this material 
where relevant.` : ""}

Format in Markdown with sections:
1. Introduction (with real-world analogy)
2. Deep Dive (explain each concept clearly)
3. Code Example (working, annotated code)
4. Key Takeaways (bullet points)

Be thorough, friendly, and practical.`;

    let contentText = await callAI(prompt)
      ?? getLocalFallbackLesson(lessonTitle, concepts);

    const judgeSchema = z.object({
      clarityScore: z.number().min(1).max(10),
      accuracyScore: z.number().min(1).max(10),
      depthScore: z.number().min(1).max(10),
      engagementScore: z.number().min(1).max(10),
      overallScore: z.number().min(1).max(10),
      issues: z.array(z.string()),
      verdict: z.enum(["pass", "needs_revision", "fail"]),
      feedback: z.string(),
    });

    const evaluateLesson = async (contentToEvaluate: string) => {
      const judgePrompt = `You are an expert educational reviewer. Evaluate the following generated lesson against these criteria:
- Clarity: Is the explanation easy to understand?
- Accuracy: Are the technical concepts correct?
- Depth: Does it go deep enough, or is it too superficial?
- Engagement: Is the tone engaging (uses analogies, formatting well)?

Lesson Title: "${lessonTitle}"
Concepts: ${JSON.stringify(concepts || [])}

Generated Content:
${contentToEvaluate}
`;
      return await callAI(judgePrompt, { schema: judgeSchema });
    };

    let evaluation = await evaluateLesson(contentText);

    if (evaluation && (evaluation.verdict === "needs_revision" || evaluation.verdict === "fail")) {
      console.log(`[Judge Agent] Lesson "${lessonTitle}" failed evaluation. Retrying...`);
      const revisionPrompt = prompt + `\n\nNOTE: A reviewer evaluated your previous attempt and found the following issues:\n${evaluation.feedback}\n\nPlease revise the lesson to address these issues. Ensure all previous constraints are met.`;
      
      contentText = await callAI(revisionPrompt) ?? contentText; // Fallback to old if it fails completely
      evaluation = await evaluateLesson(contentText); // Re-evaluate
    }

    // Fire and forget — don't block the response
    const user = (req as any).user;
    if (user) {
      import("./src/lib/memory").then(({ storeLessonMemory }) => {
        storeLessonMemory({
          userId: user.id,
          courseId: courseId || "unknown",
          lessonId: lessonId || lessonTitle,
          lessonTitle: lessonTitle,
          content: contentText,
        }).catch(err => 
          console.error("[memory] lesson store failed:", err)
        );
      });
    }

    res.json({ 
      content: contentText, 
      qualityScore: evaluation?.overallScore,
      evaluationData: evaluation 
    });
  } catch (error: any) {
    console.error("Error generating lesson content:", error);
    res.status(500).json({ error: error.message || "Failed to generate lesson content" });
  }
});

// 3. API: Generate Quiz
app.post("/api/generate-quiz", requireAuth, async (req, res) => {
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
app.post("/api/mentor-chat", requireAuth, async (req, res) => {
  try {
    const { 
      message, 
      history, 
      currentCourseTitle, 
      currentLessonTitle,
      courseId,
      currentLessonId
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

    const session = (req as any).user;
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (courseId) {
      await db.courseMessage.create({ data: { courseId, role: "user", content: message } });
    }

    // Retrieve semantically relevant past context
    const relevantMemories = await retrieveRelevantMemories({
      userId: session.id,
      courseId: courseId || "general",
      query: message,
      limit: 4,
    });

    const memoryContext = relevantMemories.length > 0
      ? `\nRelevant past learning context (from earlier sessions):\n${
          relevantMemories
            .map((m, i) => `[Memory ${i+1}]: ${m}`)
            .join("\n")
        }\n`
      : "";

    // Check if user passed their own key
    const userKey = req.headers["x-user-key"] as string | undefined;
    const googleClient = userKey ? createGoogleGenerativeAI({ apiKey: userKey }) : createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = googleClient("gemini-2.5-flash");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const systemPrompt = `You are ZachCourse Assistant — a brilliant, warm, highly knowledgeable AI mentor.

PRIMARY FOCUS: Help the student with "${currentCourseTitle || 'General Learning'}"
${currentLessonTitle ? `Current lesson: "${currentLessonTitle}"` : ""}
${memoryContext}

CRITICAL INSTRUCTIONS FOR TOOLS:
1. Only use tools (fetchUrl, searchWeb) if the student's question explicitly asks for external information, a specific URL, or current events.
2. If you use a tool, you MUST provide a final text response answering the user based on the tool's results.
3. If a tool fails, or if you don't need tools, answer using your own knowledge. ALWAYS output a final text response.
`;

    const formattedMessages = [
      ...(history || []).slice(-8).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user" as const,
        content: m.content || m.text || "",
      })),
      { role: "user" as const, content: message }
    ];

    const fetchUrlTool = tool({
      description: "Fetch and read the content of any URL.",
      inputSchema: z.object({
        url: z.string().url(),
        reason: z.string(),
      }),
      execute: async ({ url, reason }: { url: string, reason: string }) => {
        try {
          const parsedUrl = new URL(url);
          const blockedHosts = [
            "169.254.169.254", "metadata.google.internal", "localhost", "127.0.0.1", "0.0.0.0", "::1",
          ];
          const isPrivateIp = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsedUrl.hostname);
          if (blockedHosts.includes(parsedUrl.hostname) || isPrivateIp) {
            throw new Error("Access to internal/private hosts is forbidden.");
          }
          if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            throw new Error("Only HTTP/HTTPS protocols are supported.");
          }
          const abort = new AbortController();
          const timer = setTimeout(() => abort.abort(), 8000);
          const response = await fetch(url, { signal: abort.signal, headers: { "User-Agent": "ZachCourse-MentorBot/1.0" } });
          clearTimeout(timer);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          let html = await response.text();
          let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                          .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
                          .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
                          .replace(/<[^>]+>/g, " ")
                          .replace(/\s+/g, " ")
                          .trim();
          if (clean.length > 8000) clean = clean.slice(0, 8000) + "... (truncated)";
          return { success: true, content: clean, url };
        } catch (err: any) {
          return { success: false, error: String(err.message), content: "", url };
        }
      }
    });

    const searchWebTool = tool({
      description: "Search the web for current information.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => {
        try {
          const encoded = encodeURIComponent(query);
          const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(5000) });
          const data = await res.json();
          const results = [
            data.AbstractText && `Summary: ${String(data.AbstractText)}`,
            ...(data.RelatedTopics || []).slice(0, 4).map((t: any) => String(t.Text)).filter(Boolean)
          ].filter(Boolean).join("\n\n");
          return { query, results: results || "No results found", source: String(data.AbstractURL || "DuckDuckGo") };
        } catch (err: any) {
          return { query, results: "Search failed: " + String(err.message), source: "" };
        }
      }
    });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: formattedMessages,
      tools: { fetchUrl: fetchUrlTool, searchWeb: searchWebTool },
      stopWhen: isStepCount(5),
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
    }

    if (fullText.trim() === "") {
      fullText = "I'm sorry, I couldn't generate a proper response to that.";
      res.write(`data: ${JSON.stringify({ token: fullText })}\n\n`);
      
      // Temporary logging for empty responses
      try {
        console.warn("[MentorChat] Empty fullText. Steps:", await result.steps);
      } catch (e) {
        console.error("Failed to log steps", e);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    if (fullText.length > 50) {
      storeMentorExchange({
        userId: session.id,
        courseId: courseId || "general",
        lessonId: currentLessonId || "general",
        lessonTitle: currentLessonTitle || "General",
        question: message,
        answer: fullText,
      }).catch(console.error);
    }

    if (courseId) {
      db.courseMessage.create({ data: { courseId, role: "assistant", content: fullText } }).catch(console.error);
    }
  } catch (err: any) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message || "Stream failed" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/api/ai", aiRateLimit, async (req, res) => {
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
  // oEmbed endpoint for rich Discord/social embeds
  app.get('/oembed.json', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    
    res.json({
      type: "link", 
      version: "1.0",
      title: "ZachCourse",
      author_name: "ZachCourse",
      author_url: baseUrl,
      author_icon: `${baseUrl}/favicon.svg`,
      icon_url: `${baseUrl}/favicon.svg`,
      thumbnail_url: `${baseUrl}/thumbnail.png`,
      thumbnail_width: 1200,
      thumbnail_height: 630
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Transform index.html in dev mode
    app.use('*', async (req, res, next) => {
      if (req.originalUrl === '/' || req.originalUrl === '/index.html' || req.originalUrl.startsWith('/dashboard') || req.originalUrl.startsWith('/course')) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          template = template.replace(/content="\/thumbnail\.svg"/g, `content="${baseUrl}/thumbnail.png"`);
          template = template.replace(/https:\/\/zachcourse\.com\//g, `${baseUrl}/`);
          if (!template.includes('application/json+oembed')) {
            template = template.replace('</title>', `</title>\n    <link rel="alternate" type="application/json+oembed" href="${baseUrl}/oembed.json" title="ZachCourse" />`);
          }
          if (!template.includes('theme-color')) {
            template = template.replace('</title>', `</title>\n    <meta name="theme-color" content="#6366F1" />`);
          }
          if (!template.includes('twitter:creator')) {
            template = template.replace('</title>', `</title>\n    <meta name="twitter:creator" content="@ZachCourse" />`);
          }
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
          return;
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
          return;
        }
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    app.use(express.static(distPath, { index: false }));
    
    // Serve index.html dynamically to inject absolute URLs
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/assets')) return next();
      if (!req.accepts('html')) return next();
      
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      
      fs.readFile(path.join(distPath, 'index.html'), 'utf8', (err: any, data: string) => {
        if (err) return next(err);
        
        let html = data;
        html = html.replace(/content="\/thumbnail\.svg"/g, `content="${baseUrl}/thumbnail.png"`);
        html = html.replace(/https:\/\/zachcourse\.com\//g, `${baseUrl}/`);
        if (!html.includes('application/json+oembed')) {
          html = html.replace('</title>', `</title>\n    <link rel="alternate" type="application/json+oembed" href="${baseUrl}/oembed.json" title="ZachCourse" />`);
        }
        if (!html.includes('theme-color')) {
          html = html.replace('</title>', `</title>\n    <meta name="theme-color" content="#6366F1" />`);
        }
        if (!html.includes('twitter:creator')) {
          html = html.replace('</title>', `</title>\n    <meta name="twitter:creator" content="@ZachCourse" />`);
        }
        res.send(html);
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
