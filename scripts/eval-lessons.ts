import { PrismaClient } from '@prisma/client';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

const prisma = new PrismaClient();
const google = createGoogleGenerativeAI({});
const model = google("gemini-2.5-flash");

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

async function main() {
  console.log("Starting Lesson Evaluation Pipeline...");

  // Fetch some un-evaluated or recently generated lessons (limit 10 for batching)
  const lessons = await prisma.lessonContent.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  if (lessons.length === 0) {
    console.log("No lessons found in the database to evaluate.");
    return;
  }

  let passCount = 0;
  let revisionCount = 0;
  let failCount = 0;
  let totalScore = 0;

  console.log(`Found ${lessons.length} lessons to evaluate.\n`);

  for (const lesson of lessons) {
    console.log(`Evaluating Lesson ID: ${lesson.lessonId} (Course ID: ${lesson.courseId})...`);

    const judgePrompt = `You are an expert educational reviewer. Evaluate the following generated lesson against these criteria:
- Clarity: Is the explanation easy to understand?
- Accuracy: Are the technical concepts correct?
- Depth: Does it go deep enough, or is it too superficial?
- Engagement: Is the tone engaging (uses analogies, formatting well)?

Generated Content:
${lesson.content}
`;

    try {
      const { object: evaluation } = await generateObject({
        model,
        prompt: judgePrompt,
        schema: judgeSchema,
      });

      console.log(`  -> Verdict: ${evaluation.verdict.toUpperCase()} (Score: ${evaluation.overallScore}/10)`);
      console.log(`  -> Feedback: ${evaluation.feedback}`);
      console.log(`  -> Issues: ${evaluation.issues.length ? evaluation.issues.join(", ") : "None"}\n`);

      if (evaluation.verdict === "pass") passCount++;
      if (evaluation.verdict === "needs_revision") revisionCount++;
      if (evaluation.verdict === "fail") failCount++;
      totalScore += evaluation.overallScore;

      // Update in DB (optional, but good for tracking)
      await prisma.lessonContent.update({
        where: { id: lesson.id },
        data: {
          qualityScore: evaluation.overallScore,
          evaluationData: evaluation as any
        }
      });
    } catch (err) {
      console.error(`  -> Evaluation failed for this lesson: ${err}`);
    }
  }

  const avgScore = totalScore / lessons.length;
  console.log(`\n=== Evaluation Summary ===`);
  console.log(`Total Evaluated: ${lessons.length}`);
  console.log(`Average Score:   ${avgScore.toFixed(1)}/10`);
  console.log(`Pass:            ${passCount}`);
  console.log(`Needs Revision:  ${revisionCount}`);
  console.log(`Fail:            ${failCount}`);
  console.log(`==========================\n`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
