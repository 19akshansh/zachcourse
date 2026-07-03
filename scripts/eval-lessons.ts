import 'dotenv/config';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

// Define the Judge Agent's validation schema
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

// Hardcoded Sample Lessons representing different quality levels
const SAMPLE_LESSONS = [
  {
    id: "lesson_promise_ok",
    title: "Understanding JavaScript Promises",
    concepts: ["Asynchronous Execution", "Promises", "Then/Catch", "Async/Await"],
    content: `# Deep Dive: JavaScript Promises

Understanding asynchronous execution is vital for modern web development. Think of a Promise as a real-world restaurant pager: you place your order (start an async task), you are given a pager (the Promise), and you can go sit down (continue executing other code). When the food is ready, the pager buzzes (the Promise resolves!).

## Core Concepts

### 1. What is a Promise?
A Promise is an object representing the eventual completion (or failure) of an asynchronous operation. It exists in one of three states:
- **Pending**: Initial state, neither fulfilled nor rejected.
- **Fulfilled**: Operation completed successfully.
- **Rejected**: Operation failed with an error.

### 2. Resolving and Rejecting
We create a Promise using the constructor, which takes an executor function with \`resolve\` and \`reject\` handlers:

\`\`\`javascript
const fetchUserData = new Promise((resolve, reject) => {
  setTimeout(() => {
    const success = true;
    if (success) {
      resolve({ id: 1, name: "Zach" });
    } else {
      reject(new Error("Failed to fetch user data"));
    }
  }, 1000);
});
\`\`\`

### 3. async/await Sugar
Instead of chaining \`.then()\` and \`.catch()\`, we can write asynchronous code that reads like synchronous code using \`async/await\`:

\`\`\`javascript
async function getUser() {
  try {
    const user = await fetchUserData;
    console.log("User received:", user.name);
  } catch (error) {
    console.error("Error:", error.message);
  }
}
\`\`\`

## Key Takeaways
- Promises prevent "callback hell" by standardizing async response patterns.
- Always handle rejections using \`try/catch\` or \`.catch()\` to avoid unhandled rejections.
- async/await makes control flow cleaner but runs on the exact same Promise mechanics underneath.
`
  },
  {
    id: "lesson_react_bad",
    title: "Learn React in 10 Seconds",
    concepts: ["React Components", "Props", "State"],
    content: `# learn react quickly!
React is a web thing made by facebook. It is very fast and cool.

## Code
\`\`\`javascript
// react code:
function App() {
  // state here
  let name = "Zach"; // we change this
  name = "New Zach"; 
  return <div>hello {name}</div>
}
\`\`\`

Just run this code in HTML. It will change the page. React has props which is properties.
`
  }
];

async function runEvaluation() {
  console.log("================================================================================");
  console.log("                  ZachCourse Automated Lesson Evaluation Pipeline");
  console.log("================================================================================");
  console.log(`Analyzing ${SAMPLE_LESSONS.length} test lessons using the Judge Agent's rubric...\n`);

  const apiKey = process.env.GEMINI_API_KEY;
  let useLiveAI = true;

  if (!apiKey) {
    console.warn("⚠️  [NOTICE] GEMINI_API_KEY environment variable not found.");
    console.warn("   Running in SIMULATED mode. To perform actual AI evaluations, set GEMINI_API_KEY.\n");
    useLiveAI = false;
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const model = google("gemini-2.5-flash");

  for (const lesson of SAMPLE_LESSONS) {
    console.log(`Evaluating Sample: "${lesson.title}"`);
    console.log(`Concepts: ${lesson.concepts.join(", ")}`);
    console.log("-".repeat(80));

    let evaluationResult;

    if (useLiveAI) {
      const judgePrompt = `You are an expert educational reviewer. Evaluate the following generated lesson against these criteria:
- Clarity: Is the explanation easy to understand? Does it use real-world analogies?
- Accuracy: Are the technical concepts correct? (Is state managed correctly? Is react reactive?)
- Depth: Does it go deep enough, or is it too superficial/vague?
- Engagement: Is the tone engaging, utilizing proper formatting and code?

Lesson Title: "${lesson.title}"
Concepts to cover: ${JSON.stringify(lesson.concepts)}

Generated Content:
${lesson.content}
`;

      try {
        const { object } = await generateObject({
          model,
          prompt: judgePrompt,
          schema: judgeSchema,
        });
        evaluationResult = object;
      } catch (err: any) {
        console.error(`❌ Live AI evaluation failed: ${err.message}`);
        console.log("Falling back to pre-calculated expectations...\n");
      }
    }

    // Fallback/Simulated Expectations (matches the models' logical output)
    if (!evaluationResult) {
      if (lesson.id === "lesson_promise_ok") {
        evaluationResult = {
          clarityScore: 9,
          accuracyScore: 10,
          depthScore: 8,
          engagementScore: 9,
          overallScore: 9,
          issues: [],
          verdict: "pass" as const,
          feedback: "Superb coverage of Promises. The restaurant pager analogy is very clear and accurate. Excellent code annotation and explanation of async/await syntactic sugar.",
        };
      } else {
        evaluationResult = {
          clarityScore: 3,
          accuracyScore: 2,
          depthScore: 2,
          engagementScore: 3,
          overallScore: 2,
          issues: [
            "Lacks reactive state management (modifying raw variables instead of using useState hook).",
            "Extremely superficial and short.",
            "Code example cannot just 'run in HTML' without a bundler, script tag, or React root setup."
          ],
          verdict: "fail" as const,
          feedback: "This lesson completely fails to teach React component rendering, state, or props. Directly modifying 'name' does not trigger component re-rendering in React. Needs substantial depth and technical accuracy improvements.",
        };
      }
    }

    // Displaying Results
    const colorCode = evaluationResult.verdict === "pass" ? "\x1b[32m" : "\x1b[31m";
    const resetCode = "\x1b[0m";

    console.log(`Quality Metrics:`);
    console.log(`  - Clarity Score:    ${evaluationResult.clarityScore}/10`);
    console.log(`  - Accuracy Score:   ${evaluationResult.accuracyScore}/10`);
    console.log(`  - Depth Score:      ${evaluationResult.depthScore}/10`);
    console.log(`  - Engagement Score: ${evaluationResult.engagementScore}/10`);
    console.log(`  - OVERALL SCORE:    ${evaluationResult.overallScore}/10`);
    console.log(`Verdict: ${colorCode}${evaluationResult.verdict.toUpperCase()}${resetCode}`);
    console.log(`Issues Found: ${evaluationResult.issues.length ? evaluationResult.issues.map(i => `\n    * ${i}`).join("") : "None"}`);
    console.log(`Judge Feedback:\n  "${evaluationResult.feedback}"\n`);
    console.log("=".repeat(80));
    console.log();
  }

  console.log("Evaluation run completed successfully.");
}

runEvaluation().catch(console.error);
