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
import { isBlockedUrl, isBlockedUrlResolved } from "./src/lib/ssrf-guard";
import { getLocalFallbackRoadmap, getLocalFallbackLesson, getLocalFallbackQuiz, getLocalFallbackMentorReply } from "./src/lib/local-fallbacks";
import { generateRoadmapContent, generateVisualRoadmapContent } from "./src/server/agents/roadmap-agent";
import { TONE_INSTRUCTIONS, LANGUAGE_INSTRUCTIONS } from "./src/lib/tone-options";
import { fetchUrlTool, searchWebTool } from "./src/lib/mentor-tools";
import { sanitizeResourceUrl } from "./src/lib/resource-link";

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
    
    try {
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      
      const parsedUrl = new URL(origin);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return callback(null, true);
      }
      
      callback(new Error("Not allowed by CORS"));
    } catch (err) {
      // Malformed origin header fails closed
      callback(new Error("Invalid Origin"));
    }
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


// Helper to get a model — easy to swap


app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: [
        "'self'",
        "http://localhost:3000",
        "http://localhost:5173",
        "ws://localhost:3000",
        "ws://localhost:5173",
        "https://*.run.app",
        "https://generativelanguage.googleapis.com",
        ...(ALLOWED_ORIGINS || []),
      ],
      frameAncestors: [
        "'self'",
        "https://aistudio.google.com",
        "https://*.usercontent.goog",
      ],
    },
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
}));
// Custom body parsers that do not intercept Better Auth routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth") && !req.path.endsWith("/sign-up/email")) {
    return next();
  }
  express.json({ limit: "2mb" })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    return next();
  }
  express.urlencoded({ extended: true, limit: "2mb" })(req, res, next);
});

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
      if (!options.apiKey) throw new Error("MISSING_API_KEY");
      const googleClient = createGoogleGenerativeAI({ apiKey: options.apiKey });
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

// ============================================================================
// ROADMAP AGENT & CRITIC AGENT FLOW
// ============================================================================
// • Purpose: Translates a student's topic, pasted text/syllabus, or reference URLs
//   into a comprehensive, personalized module-by-module study path.
// • Technique Selection: Uses `generateObject` (schema-driven) with a strict
//   Zod schema. This approach is highly preferred over free-text `generateText`
//   because roadmaps are structural data backbones. It guarantees that the 
//   generated roadmap perfectly matches the frontend's rendering contract.
// • Inline Critic Agent: Features a synchronous curriculum-review Critic Agent. 
//   If flaws are detected (e.g. prerequisite errors or unrealistic times), the Critic 
//   rejects the candidate and triggers a targeted re-prompt.
// • Design Constraint: The Critic's self-correction retry loop is capped at EXACTLY
//   1 retry. This limits latency overhead to ensure a fast, responsive UI load time.
// ============================================================================
// 1. API: Generate Roadmap
app.post("/api/generate-roadmap", requireAuth, async (req, res) => {
  const { topic, sourceUrl, textContent, documentContext, language } = req.body;
  let userKey = req.headers["x-user-key"] as string | undefined;
  if (userKey === "null" || userKey === "undefined" || userKey === "") userKey = undefined;
    if (!userKey) {
      res.status(403).json({ error: "Missing API key" });
      return;
    }
  if (!userKey) {
    res.status(403).json({ error: "Missing API key" });
    return;
  }
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
    const backgroundContext = req.body.backgroundContext || "";
    const tone = req.body.tone || "friendly";
    const weeklyHours = req.body.weeklyHours || 5;

    const roadmapData = await generateRoadmapContent({
      topic,
      experienceLevel,
      backgroundContext,
      weeklyHours,
      sourceUrl,
      textContent,
      documentContext,
      tone,
      language,
      userKey,
    });

    res.json({ roadmap: roadmapData });
  } catch (error: any) {
    console.error("Error generating roadmap:", error);
    res.status(500).json({ error: error.message || "Failed to generate roadmap" });
  }
});

// ============================================================================
// VISUAL ROADMAP AGENT & CRITIC AGENT FLOW
// ============================================================================
// • Purpose: Formulates a fully mapped-out interactive curriculum node-graph
//   consisting of linear lessons, side paths, and checkpoint milestones.
// • Technique Selection: Employs `generateObject` with an advanced Zod schema. 
//   Since the UI directly renders this data as React Flow components (via `@xyflow/react`),
//   structural soundness is paramount. Free-form text (`generateText`) would fail to 
//   safely populate graph properties like node-edge identifiers, types, and coordinates.
// • Critic Check: Runs an inline Critic review specialized in graph constraints (e.g.
//   preventing disconnected/orphaned nodes, missing dependencies, or invalid links).
// • Latency/Resiliency Trade-off: Capped at exactly 1 re-prompt, ensuring high-quality
//   graphs without risking timeouts.
// ============================================================================
app.post("/api/generate-visual-roadmap", aiRateLimit, async (req, res) => {
  const { topic, experienceLevel, backgroundContext, weeklyHours, sourceUrl, documentContext, tone, language } = req.body
  
  try {
    let userKey = req.headers["x-user-key"] as string | undefined;
  if (userKey === "null" || userKey === "undefined" || userKey === "") userKey = undefined;
    const data = await generateVisualRoadmapContent({
      topic,
      experienceLevel,
      backgroundContext,
      weeklyHours,
      sourceUrl,
      documentContext,
      tone, language, userKey, });

    if (!data) {
      res.status(500).json({ error: "Generation failed" })
      return
    }

    res.json({ roadmap: data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// LESSON AGENT (STUDY GUIDE) & JUDGE AGENT EVALUATION FLOW
// ============================================================================
// • Purpose: Authors a highly detailed Markdown study guide for a given lesson,
//   custom-scoped to the lesson's concept list and optional reference document context.
// • Technique Selection: Employs standard free-form text generation (`generateText` / no schema)
//   because study guides require high-density, conversational prose, creative code examples,
//   and fluid Markdown formatting which strict schema generation would overly constrain.
// • Inline Judge Agent: Integrates an automated evaluator (Judge Agent) which critiques the
//   study guide's clarity, technical accuracy, depth, and engagement against a rubric.
// • Resiliency Loop: If the score falls below standard or a verdict of revision/fail is issued,
//   the Lesson Agent is re-prompted. The loop caps at exactly 1 self-correction step
//   to balance learning quality with fast generation performance.
// ============================================================================
// 2. API: Generate Study Guide Content
app.post("/api/generate-lesson", requireAuth, async (req, res) => {
  const { roadmapKey, moduleId, lessonId, lessonTitle, concepts, courseContext, documentContext, courseId, experienceLevel, backgroundContext, tone, language } = req.body;
  let userKey = req.headers["x-user-key"] as string | undefined;
  if (userKey === "null" || userKey === "undefined" || userKey === "") userKey = undefined;
  if (!userKey) {
    res.status(403).json({ error: "Missing API key" });
    return;
  }
  try {
    if (!lessonTitle) {
      res.status(400).json({ error: "Missing lessonTitle" });
      return;
    }

    const safeDocContext = typeof documentContext === "string"
      ? documentContext.slice(0, 20_000)
      : "";

    const toneInstruction = TONE_INSTRUCTIONS[tone || "friendly"] ?? TONE_INSTRUCTIONS.friendly;
    const languageInstruction = LANGUAGE_INSTRUCTIONS[language || "en"] ?? LANGUAGE_INSTRUCTIONS.en;

    const prompt = `You are an expert tutor. Write a complete, 
engaging study guide for:
Lesson: "${lessonTitle}"
Concepts: ${JSON.stringify(concepts || [])}
Target Level: ${experienceLevel || "beginner"}
Content tone: ${toneInstruction}
Language Requirement: ${languageInstruction}
${backgroundContext ? `Learner Background: ${backgroundContext}` : ""}
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

    let contentText = await callAI(prompt, { apiKey: userKey })
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
      return await callAI(judgePrompt, { schema: judgeSchema, apiKey: userKey });
    };

    let evaluation = await evaluateLesson(contentText);

    if (evaluation && (evaluation.verdict === "needs_revision" || evaluation.verdict === "fail")) {
      console.log(`[Judge Agent] Lesson "${lessonTitle}" failed evaluation. Retrying...`);
      const revisionPrompt = prompt + `\n\nNOTE: A reviewer evaluated your previous attempt and found the following issues:\n${evaluation.feedback}\n\nPlease revise the lesson to address these issues. Ensure all previous constraints are met.`;
      
      contentText = await callAI(revisionPrompt, { apiKey: userKey }) ?? contentText; // Fallback to old if it fails completely
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

// ============================================================================
// QUIZ AGENT FLOW
// ============================================================================
// • Purpose: Authors exactly 3 multiple-choice questions custom-tailored to the
//   study material or lesson title provided.
// • Technique Selection: Utilizes `generateObject` with a strict array-based Zod
//   schema. Using a schema ensures that the generated response is structured correctly,
//   with exactly 4 options per question and a valid 0-3 index for the correct answer,
//   allowing the frontend interactive trivia game to execute error-free.
// • Design Details: Dictates a balanced cognitive load distribution (1 easy,
//   1 medium, 1 hard question) to test conceptual understanding rather than rote recall.
// ============================================================================
// 3. API: Generate Quiz
app.post("/api/generate-quiz", requireAuth, async (req, res) => {
  const { lessonTitle, lessonContent, tone, language } = req.body;
  let userKey = req.headers["x-user-key"] as string | undefined;
  if (userKey === "null" || userKey === "undefined" || userKey === "") userKey = undefined;
  if (!userKey) {
    res.status(403).json({ error: "Missing API key" });
    return;
  }
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

    const toneInstruction = TONE_INSTRUCTIONS[tone || "friendly"] ?? TONE_INSTRUCTIONS.friendly;
    const languageInstruction = LANGUAGE_INSTRUCTIONS[language || "en"] ?? LANGUAGE_INSTRUCTIONS.en;
    const prompt = `Generate exactly 3 multiple-choice quiz 
questions to test understanding of: "${lessonTitle}"
${lessonContent ? "Content summary: " + lessonContent.slice(0, 600) : ""}
Content tone (especially for explanations): ${toneInstruction}
Language Requirement: ${languageInstruction}

Requirements:
- Test understanding not memorization
- 4 options each, only 1 correct
- Include clear explanation for correct answer
- Vary difficulty: 1 easy, 1 medium, 1 hard`;

    const quizData = await callAI(prompt, { schema, apiKey: userKey })
      ?? getLocalFallbackQuiz(lessonTitle, req.body.concepts || []);

    res.json(quizData);
  } catch (error: any) {
    console.error("Error generating quiz:", error);
    res.status(500).json({ error: error.message || "Failed to generate quiz" });
  }
});

// ============================================================================
// MENTOR AGENT FLOW (AGENTIC LOOP + RAG)
// ============================================================================
// • Purpose: Acts as an interactive personal learning tutor that answers
//   questions, recalls historical chat exchanges, reads public web links, and
//   searches the web for up-to-date context.
// • Technique Selection: Employs `streamText` to deliver real-time, token-by-token
//   responses. Integrates registered tools (`fetchUrl` and `searchWeb`) forming a
//   multi-step agentic execution loop.
// • Retrieval Augmented Generation (RAG): Before responding, queries pgvector to
//   surface semantically relevant fragments of earlier lessons or mentor chats,
//   injecting them as background context into the prompt.
// • Design Decision (Step Count Limit): The agentic loop is restricted to a maximum 
//   of `isStepCount(5)` iterations. This prevents infinite tool execution loops,
//   saves token quotas, and guarantees a rapid turnaround for the user.
// • SSRF Protection: The registered `fetchUrl` tool routes all URLs through the
//   centralized `isBlockedUrl` validator. This blocks loopback requests, internal Cloud
//   Run metadata servers, and private subnets, completely neutralizing SSRF vectors.
// ============================================================================
// 4. API: Ask Mentor Chat
app.post("/api/mentor-chat", requireAuth, async (req, res) => {
  try {
    const { 
      message, 
      history, 
      currentCourseTitle, 
      currentLessonTitle,
      courseId,
      currentLessonId,
      language
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

    let backgroundContext = "";
    let experienceLevel = "beginner";
    let tone = "friendly";

    if (courseId) {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { backgroundContext: true, experienceLevel: true, tone: true },
      });
      if (course) {
        backgroundContext = course.backgroundContext || "";
        experienceLevel = course.experienceLevel || "beginner";
        tone = course.tone || "friendly";
      }
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

    let userKey = req.headers["x-user-key"] as string | undefined;
  if (userKey === "null" || userKey === "undefined" || userKey === "") userKey = undefined;
    if (!userKey) {
      res.status(403).json({ error: "Missing API key" });
      return;
    }
    const googleClient = createGoogleGenerativeAI({ apiKey: userKey });
    const model = googleClient("gemini-2.5-flash");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.friendly;

    const languageInstruction = LANGUAGE_INSTRUCTIONS[language || "en"] ?? LANGUAGE_INSTRUCTIONS.en;
    const systemPrompt = `You are ZachCourse Assistant — a brilliant, warm, highly knowledgeable AI mentor.

PRIMARY FOCUS: Help the student with "${currentCourseTitle || 'General Learning'}"
${currentLessonTitle ? `Current lesson: "${currentLessonTitle}"` : ""}
Target Level: ${experienceLevel}
Language Requirement: ${languageInstruction}
Content tone: ${toneInstruction}
${backgroundContext ? `Learner Background: ${backgroundContext}` : ""}
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

    let userKey = req.headers["x-user-key"] as string | undefined;
  if (userKey === "null" || userKey === "undefined" || userKey === "") userKey = undefined;
    if (!userKey) {
      res.status(403).json({ error: "Missing API key" });
      return;
    }

    const text = await callAI(prompt, { systemPrompt, apiKey: userKey });
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
