const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const mentorChatStart = content.indexOf('app.post("/api/mentor-chat"');
const aiChatStart = content.indexOf('app.post("/api/ai"');

if (mentorChatStart === -1 || aiChatStart === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const before = content.slice(0, mentorChatStart);
const after = content.slice(aiChatStart);

const newMentorChat = `app.post("/api/mentor-chat", requireAuth, async (req, res) => {
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

    // Retrieve semantically relevant past context
    const relevantMemories = await retrieveRelevantMemories({
      userId: session.id,
      courseId: courseId || "general",
      query: message,
      limit: 4,
    });

    const memoryContext = relevantMemories.length > 0
      ? \`\\nRelevant past learning context (from earlier sessions):\\n\${
          relevantMemories
            .map((m, i) => \`[Memory \${i+1}]: \${m}\`)
            .join("\\n")
        }\\n\`
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

    const systemPrompt = \`You are ZachCourse Assistant — a brilliant, warm, highly knowledgeable AI mentor.

PRIMARY FOCUS: Help the student with "\${currentCourseTitle || 'General Learning'}"
\${currentLessonTitle ? \`Current lesson: "\${currentLessonTitle}"\` : ""}
\${memoryContext}
Current message from student:\`;

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
          const isPrivateIp = /^(10\\.|172\\.(1[6-9]|2\\d|3[01])\\.|192\\.168\\.)/.test(parsedUrl.hostname);
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
          if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
          let html = await response.text();
          let clean = html.replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, "")
                          .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, "")
                          .replace(/<nav\\b[^<]*(?:(?!<\\/nav>)<[^<]*)*<\\/nav>/gi, "")
                          .replace(/<footer\\b[^<]*(?:(?!<\\/footer>)<[^<]*)*<\\/footer>/gi, "")
                          .replace(/<[^>]+>/g, " ")
                          .replace(/\\s+/g, " ")
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
          const res = await fetch(\`https://api.duckduckgo.com/?q=\${encoded}&format=json&no_html=1&skip_disambig=1\`, { signal: AbortSignal.timeout(5000) });
          const data = await res.json();
          const results = [
            data.AbstractText && \`Summary: \${String(data.AbstractText)}\`,
            ...(data.RelatedTopics || []).slice(0, 4).map((t: any) => String(t.Text)).filter(Boolean)
          ].filter(Boolean).join("\\n\\n");
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
      res.write(\`data: \${JSON.stringify({ token: chunk })}\\n\\n\`);
    }

    res.write(\`data: \${JSON.stringify({ done: true })}\\n\\n\`);
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
      Promise.all([
        db.courseMessage.create({ data: { courseId, role: "user", content: message } }),
        db.courseMessage.create({ data: { courseId, role: "assistant", content: fullText } }),
      ]).catch(console.error);
    }
  } catch (err: any) {
    if (res.headersSent) {
      res.write(\`data: \${JSON.stringify({ error: err.message || "Stream failed" })}\\n\\n\`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

`;

fs.writeFileSync('server.ts', before + newMentorChat + after);
console.log("Success");
