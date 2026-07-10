import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { getLocalFallbackRoadmap } from "../../lib/local-fallbacks";
import { sanitizeResourceUrl } from "../../lib/resource-link";
import { TONE_INSTRUCTIONS, LANGUAGE_INSTRUCTIONS } from "../../lib/tone-options";



export const roadmapSchema = z.object({
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

export const visualRoadmapSchema = z.object({
  title: z.string(),
  topic: z.string(),
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
});

// Helper for sleep/delay during backoff
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Highly robust wrapper for calling Gemini API with exponential backoff and model/local fallbacks
async function callAI(
  prompt: string,
  options: { json?: boolean; schema?: z.ZodType<any>, systemPrompt?: string, apiKey?: string } = {}
): Promise<any> {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro"
  ];
  
  const key = options.apiKey;
  if (typeof key !== "string") {
    throw new Error("INVALID_API_KEY");
  }
  const trimmed = key.trim();
  if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
    throw new Error("MISSING_API_KEY");
  }
  if (trimmed.length < 20) {
    throw new Error("INVALID_API_KEY");
  }
  const googleClient = createGoogleGenerativeAI({ apiKey: trimmed });

  for (const modelId of models) {
    try {
      const model = googleClient(modelId);
      
      if (options.schema) {
        const { object } = await generateObject({
          model,
          prompt,
          schema: options.schema,
        });
        return object;
      }
      return null;
    } catch (err: any) {
      console.warn(`[callAI] Error with model ${modelId}:`, err?.message || err);
      // If quota or billing/permission error, try next model, but wait briefly
      await sleep(1000);
    }
  }
  return null;
}

export interface GenerateRoadmapInput {
  topic: string;
  experienceLevel?: string;
  backgroundContext?: string;
  weeklyHours?: number;
  sourceUrl?: string;
  textContent?: string;
  documentContext?: string;
  tone?: string;
  userKey?: string;
  referenceRoadmapData?: any; // Original course roadmap JSON to use as structural context
  language?: string;
}

export async function generateRoadmapContent(input: GenerateRoadmapInput) {
  const {
    topic,
    experienceLevel = "beginner",
    backgroundContext = "",
    weeklyHours = 5,
    sourceUrl = "",
    textContent = "",
    documentContext = "",
    tone = "friendly",
    userKey,
    referenceRoadmapData,
    language = "en"
  } = input;

  const safeDocContext = documentContext ? documentContext.slice(0, 40_000) : "";
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.friendly;
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] ?? LANGUAGE_INSTRUCTIONS.en;

  let prompt = `You are an expert curriculum designer.
Create a personalized learning roadmap for:
Topic: ${topic}
Experience level: ${experienceLevel}
${backgroundContext ? "Learner background context: " + backgroundContext : ""}
Hours per week: ${weeklyHours}
Content tone: ${toneInstruction}
Language requirement: ${languageInstruction}
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
` : ""}`;

  if (referenceRoadmapData) {
    prompt += `\n\nReference Curriculum (MUST use this as the structural backbone — same module count, same topics, and same overall scope, but re-author the depth, pacing, level, and explanations for the learner profile above):\n<reference_curriculum>\n${JSON.stringify(referenceRoadmapData)}\n</reference_curriculum>`;
  }

  prompt += `\n\nRules:
- 3-5 modules, each with 3-5 lessons
- Progressive difficulty
- Last lesson must be a hands-on project
- First lesson completable in under 30 min
- Adapt depth to experience level`;

  let roadmapData = await callAI(prompt, { schema: roadmapSchema, apiKey: userKey })
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
    const critique = await callAI(criticPrompt, { schema: criticSchema, apiKey: userKey });
    
    if (critique && !critique.approved && critique.revisionNotes) {
      console.log(`[Critic Agent] Roadmap rejected. Issues: ${critique.issues.length}. Retrying...`);
      const revisionPrompt = prompt + `\n\nNOTE: A reviewer evaluated your previous attempt and found the following issues:\n${critique.revisionNotes}\n\nPlease revise the roadmap to address these issues.`;
      
      roadmapData = await callAI(revisionPrompt, { schema: roadmapSchema, apiKey: userKey }) ?? roadmapData;
      reviewMeta = { revised: true, issuesFound: critique.issues.length };
    } else if (critique) {
      reviewMeta = { revised: false, issuesFound: critique.issues.length };
    }
  }
  
  if (roadmapData) {
    (roadmapData as any)._reviewMeta = reviewMeta;
  }

  return roadmapData;
}

export async function generateVisualRoadmapContent(input: GenerateRoadmapInput) {
  const {
    topic,
    experienceLevel = "beginner",
    backgroundContext = "",
    weeklyHours = 5,
    sourceUrl = "",
    documentContext = "",
    tone = "friendly",
    userKey,
    referenceRoadmapData,
    language = "en"
  } = input;

  const schema = visualRoadmapSchema;

  const safeDocContext = documentContext ? documentContext.slice(0, 40_000) : "";
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.friendly;
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] ?? LANGUAGE_INSTRUCTIONS.en;

  let prompt = `You are a world-class curriculum architect.
Generate a comprehensive visual learning roadmap as a graph.

Topic: "${topic}"
Experience level: ${experienceLevel}
${backgroundContext ? "Learner background context: " + backgroundContext : ""}
Hours per week: ${weeklyHours}
Content tone: ${toneInstruction}
Language requirement: ${languageInstruction}
${sourceUrl ? "Reference: " + sourceUrl : ""}
${safeDocContext ? `
Reference Document Content (use this as primary source):
<document_context>
${safeDocContext}
</document_context>
Prioritise this document content over general knowledge 
when creating the roadmap. Extract real module names, 
topics, and structure from it where possible.
` : ""}`;

  if (referenceRoadmapData) {
    prompt += `\n\nReference Graph Curriculum (MUST use this as the structural backbone — same overall nodes, module structure, and topics, but re-author the depth, pacing, levels, and resource descriptions for the learner profile above):\n<reference_curriculum_graph>\n${JSON.stringify(referenceRoadmapData)}\n</reference_curriculum_graph>`;
  }

  prompt += `\n\nGRAPH STRUCTURE RULES:
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
   - The "start" node must connect to the first module node.
   - Each module node must connect to its first lesson node.
   - Lessons connect linearly within a module.
   - The last lesson in a module must connect to its milestone.
   - Milestones gate the next module (connect milestone to next module node).
   - The final milestone connects to the "end" node.
   - Some lessons can have parallel optional paths
8. Include 2-3 OPTIONAL side-path nodes for "going deeper"
   connected with type: "optional"
9. CRITICAL: Every node MUST be connected. No floating nodes.

CONTENT RULES:
- Every lesson node MUST have: concepts (3-5 terms), 
  duration, difficulty, and 2-3 resources.
- For resources:
  - Only reference well-known, stable resources you're confident exist: 
    official docs (developer.mozilla.org, react.dev, docs.python.org, etc.), 
    major learning platforms (freeCodeCamp, W3Schools, YouTube, GitHub), or 
    the primary official site for the topic.
  - NEVER invent a specific article/blog post URL, path, or slug you 
    cannot verify exists.
  - If unsure of an exact URL, set url to the site's known homepage/search 
    page instead of a fabricated deep link, or omit url entirely.
  - Explicitly forbid example.com, example.org, placeholder.com, or any 
    other placeholder/dummy domain.
- Make descriptions specific and actionable
  (not "learn about X" but "build a X that does Y")
- Progressive difficulty: Beginner → Intermediate → Advanced
- First lesson: completable in 20 minutes
- Last project: portfolio-worthy, takes 2-4 hours

Produce a graph with 20-35 total nodes and 25-40 edges.`;

  let data = await callAI(prompt, { schema, apiKey: userKey });
  if (!data) return null;

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
  

  // Deterministic graph connectivity repair pass
  if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
    const connectedSet = new Set();
    for (const edge of data.edges) {
      if (edge.source) connectedSet.add(edge.source);
      if (edge.target) connectedSet.add(edge.target);
    }

    for (const node of data.nodes) {
      if (!connectedSet.has(node.id)) {
        console.warn(`[Critic Agent] Auto-repairing orphaned node: ${node.id} (${node.type})`);
        
        let attached = false;
        if (node.type === "lesson") {
          let targetId = null;
          for (let i = data.nodes.indexOf(node) - 1; i >= 0; i--) {
            const prev = data.nodes[i];
            if (prev.moduleId === node.moduleId && connectedSet.has(prev.id)) {
              targetId = prev.id;
              break;
            }
          }
          if (!targetId) {
            const mod = data.nodes.find(n => n.id === node.moduleId || (n.type === "module" && n.id === node.moduleId));
            if (mod) targetId = mod.id;
          }
          if (targetId) {
            data.edges.push({ id: `repair-${targetId}-${node.id}`, source: targetId, target: node.id, type: "required" });
            connectedSet.add(node.id);
            attached = true;
          }
        } else if (node.type === "module") {
          let targetId = "start";
          for (let i = data.nodes.indexOf(node) - 1; i >= 0; i--) {
            const prev = data.nodes[i];
            if (prev.type === "milestone" && connectedSet.has(prev.id)) {
              targetId = prev.id;
              break;
            }
          }
          data.edges.push({ id: `repair-${targetId}-${node.id}`, source: targetId, target: node.id, type: "required" });
          connectedSet.add(node.id);
          
          const firstLesson = data.nodes.find(n => n.moduleId === node.id && n.type === "lesson");
          if (firstLesson) {
            data.edges.push({ id: `repair-${node.id}-${firstLesson.id}`, source: node.id, target: firstLesson.id, type: "required" });
            connectedSet.add(firstLesson.id);
          }
          attached = true;
        } else if (node.type === "milestone") {
          let sourceId = null;
          for (let i = data.nodes.indexOf(node) - 1; i >= 0; i--) {
            const prev = data.nodes[i];
            if (prev.type === "lesson" && prev.moduleId === node.moduleId) {
              sourceId = prev.id;
              break;
            }
          }
          if (sourceId) {
            data.edges.push({ id: `repair-${sourceId}-${node.id}`, source: sourceId, target: node.id, type: "required" });
          } else {
            const prev = data.nodes[data.nodes.indexOf(node) - 1];
            if (prev) {
              data.edges.push({ id: `repair-${prev.id}-${node.id}`, source: prev.id, target: node.id, type: "required" });
            }
          }
          connectedSet.add(node.id);
          attached = true;
        }

        if (!attached) {
          let targetId = null;
          for (let i = data.nodes.indexOf(node) - 1; i >= 0; i--) {
            const prev = data.nodes[i];
            if ((prev.type === "milestone" || prev.type === "module") && connectedSet.has(prev.id)) {
              targetId = prev.id;
              break;
            }
          }
          if (!targetId) {
            const prev = data.nodes[data.nodes.indexOf(node) - 1];
            if (prev) targetId = prev.id;
          }
          if (targetId) {
            data.edges.push({ id: `repair-${targetId}-${node.id}`, source: targetId, target: node.id, type: "optional" });
            connectedSet.add(node.id);
          }
        }
      }
    }
  }


  // Defensive server-side sanitization and async URL reachability check
  if (data && Array.isArray(data.nodes)) {
    const urlChecks = [];
    
    for (const node of data.nodes) {
      if (Array.isArray(node.resources)) {
        for (const resItem of node.resources) {
          resItem.url = sanitizeResourceUrl(resItem.url, resItem.title, resItem.type);
          
          if (resItem.url && !resItem.url.startsWith("https://www.google.com/search")) {
            urlChecks.push((async () => {
              try {
                let response = await fetch(resItem.url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
                if (!response.ok && response.status !== 405) {
                  response = await fetch(resItem.url, { method: 'GET', headers: { 'Range': 'bytes=0-0' }, signal: AbortSignal.timeout(4000) });
                }
                if (!response.ok && response.type !== 'opaqueredirect') {
                  const query = `${resItem.title} ${resItem.type}`.trim();
                  resItem.url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                }
              } catch (e) {
                const query = `${resItem.title} ${resItem.type}`.trim();
                resItem.url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
              }
            })());
          }
        }
      }
    }
    
    await Promise.allSettled(urlChecks);
  }


  if (data) {
    (data as any)._reviewMeta = reviewMeta;
  }

  return data;
}
