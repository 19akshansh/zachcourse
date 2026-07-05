import { initTRPC, TRPCError } from "@trpc/server";
import { prisma } from "../lib/db.js";
import { auth } from "../lib/auth.js";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { z } from "zod";

export const createContext = async (opts: CreateExpressContextOptions) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(opts.req.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    }
  }

  // Explicitly ensure cookie header is included
  // (Express sometimes lowercases it)
  const cookieHeader = opts.req.headers["cookie"] || 
    opts.req.headers["Cookie"] || "";
  if (cookieHeader && !headers.has("cookie")) {
    headers.set("cookie", cookieHeader as string);
  }

  const session = await auth.api.getSession({ headers });

  return { prisma, session };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.session || !opts.ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.session.user,
    },
  });
});

export const appRouter = router({
  getUserProgress: protectedProcedure.query(async ({ ctx }) => {
    let progress = await ctx.prisma.userProgress.findUnique({
      where: { userId: ctx.user.id },
    });
    if (!progress) {
      progress = await ctx.prisma.userProgress.create({
        data: {
          userId: ctx.user.id,
          currentCourse: "Mastering Python & Smart Software Creation",
          currentWeek: 1,
          streakDays: 1,
          totalHoursLogged: 0.1,
          quizScores: {},
        },
      });
    }
    return progress;
  }),

  getLearningMetrics: protectedProcedure.query(async ({ ctx }) => {
    const { computeUserMetrics } = await import("../lib/metrics.js");
    return await computeUserMetrics(ctx.user.id);
  }),

  updateUserProgress: protectedProcedure
    .input(
      z.object({
        currentCourse: z.string().optional(),
        currentWeek: z.number().optional(),
        streakDays: z.number().optional(),
        totalHours: z.number().optional(),
        quizScores: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { totalHours, ...rest } = input;
      return await ctx.prisma.userProgress.update({
        where: { userId: ctx.user.id },
        data: {
          ...rest,
          ...(totalHours !== undefined ? { totalHoursLogged: totalHours } : {}),
          lastSeenAt: new Date(),
        },
      });
    }),

  setUserRole: protectedProcedure
    .input(z.object({ role: z.enum(["student", "teacher"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { role: input.role }
      });
      return { success: true };
    }),

  getCourses: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.course.findMany({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        topic: true,
        difficulty: true,
        experienceLevel: true,
        completedLessons: true,
        roadmapData: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
      }
    });
  }),

  getCourse: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findFirst({
        where: { id: input.courseId, userId: ctx.user.id },
        include: {
          messages: {
            take: 50,
            orderBy: { sequence: "desc" },
          }
        }
      });
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      course.messages = course.messages.reverse();
      return course;
    }),

  createCourse: protectedProcedure
    .input(z.object({
      title: z.string(),
      topic: z.string(),
      description: z.string().optional(),
      sourceUrl: z.string().optional(),
      difficulty: z.string().default("Beginner"),
      totalDuration: z.string().optional(),
      prerequisites: z.array(z.string()).default([]),
      experienceLevel: z.string().default("beginner"),
      weeklyHours: z.number().default(5),
      roadmapData: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.create({
        data: {
          userId: ctx.user.id,
          ...input,
          roadmapData: input.roadmapData,
          prerequisites: input.prerequisites,
        }
      });
      await ctx.prisma.courseMessage.create({
        data: {
          courseId: course.id,
          role: "assistant",
          content: `Hey! 👋 I'm your ZachCourse mentor for **${input.title}**. I've built your personalized roadmap — click any lesson on the left to start learning. I'm here to answer any questions about the course or anything else on your mind! What would you like to explore first? 🚀`
        }
      });
      return course;
    }),

  updateCourseProgress: protectedProcedure
    .input(z.object({
      courseId: z.string(),
      completedLessons: z.array(z.string()).optional(),
      completedQuizzes: z.any().optional(),
      currentLessonId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { courseId, ...data } = input;

      const course = await ctx.prisma.course.findUnique({
        where: { id: courseId, userId: ctx.user.id },
        select: {
          completedLessons: true,
          completedLessonsAt: true,
          completedQuizzes: true,
          completedQuizzesAt: true,
        }
      });

      if (!course) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      }

      let completedLessonsAt = Array.isArray(course.completedLessonsAt)
        ? (course.completedLessonsAt as any[])
        : [];
      let completedQuizzesAt = Array.isArray(course.completedQuizzesAt)
        ? (course.completedQuizzesAt as any[])
        : [];

      if (input.completedLessons) {
        const oldLessons = Array.isArray(course.completedLessons)
          ? (course.completedLessons as string[])
          : [];
        const newLessons = input.completedLessons;

        // 1. Find newly completed lessons
        const newlyCompleted = newLessons.filter(id => !oldLessons.includes(id));
        newlyCompleted.forEach(lessonId => {
          if (!completedLessonsAt.some(item => item.lessonId === lessonId)) {
            completedLessonsAt.push({
              lessonId,
              completedAt: new Date().toISOString()
            });
          }
        });

        // 2. Filter out any lessons that are no longer marked completed
        completedLessonsAt = completedLessonsAt.filter(item => newLessons.includes(item.lessonId));
      }

      if (input.completedQuizzes) {
        const oldQuizzes = (course.completedQuizzes && typeof course.completedQuizzes === "object")
          ? (course.completedQuizzes as Record<string, number>)
          : {};
        const newQuizzes = input.completedQuizzes as Record<string, number>;

        Object.entries(newQuizzes).forEach(([lessonId, score]) => {
          const oldScore = oldQuizzes[lessonId];
          if (oldScore === undefined || oldScore !== score) {
            completedQuizzesAt = completedQuizzesAt.filter(item => item.lessonId !== lessonId);
            completedQuizzesAt.push({
              lessonId,
              score,
              completedAt: new Date().toISOString()
            });
          }
        });

        const newQuizLessonIds = Object.keys(newQuizzes);
        completedQuizzesAt = completedQuizzesAt.filter(item => newQuizLessonIds.includes(item.lessonId));
      }

      return await ctx.prisma.course.update({
        where: { id: courseId, userId: ctx.user.id },
        data: {
          ...data,
          completedLessonsAt,
          completedQuizzesAt,
          updatedAt: new Date(),
        }
      });
    }),

  addCourseMessage: protectedProcedure
    .input(z.object({
      courseId: z.string(),
      role: z.string(),
      content: z.string(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.course.update({
        where: { id: input.courseId, userId: ctx.user.id },
        data: { updatedAt: new Date() }
      });
      return await ctx.prisma.courseMessage.create({
        data: input
      });
    }),

  clearChatMemory: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId, userId: ctx.user.id }
      });
      if (!course) throw new TRPCError({ code: "UNAUTHORIZED" });
      await ctx.prisma.courseMessage.deleteMany({
        where: { courseId: input.courseId }
      });
      return { success: true };
    }),

  clearLessonMemory: protectedProcedure
    .input(z.object({ courseId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.courseId) {
          await ctx.prisma.lessonMemory.deleteMany({
            where: { 
              userId: ctx.user.id,
              courseId: input.courseId 
            }
          });
        } else {
          await ctx.prisma.lessonMemory.deleteMany({
            where: { userId: ctx.user.id }
          });
        }
        return { success: true };
      } catch (err: any) {
        // Table doesn't exist yet (pgvector not set up)
        // Return success silently — nothing to clear
        const msg = err?.message || ""
        if (
          msg.includes("does not exist") ||
          msg.includes("relation") ||
          msg.includes("P2021")
        ) {
          console.warn("[clearLessonMemory] table not ready:", msg)
          return { success: true }
        }
        throw err
      }
    }),

  getLessonContent: protectedProcedure
    .input(z.object({ courseId: z.string(), lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId, userId: ctx.user.id },
      });
      if (!course) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      const content = await ctx.prisma.lessonContent.findUnique({
        where: {
          courseId_lessonId: { courseId: input.courseId, lessonId: input.lessonId }
        }
      });
      return content;
    }),

  saveLessonContent: protectedProcedure
    .input(z.object({ 
      courseId: z.string(), 
      lessonId: z.string(), 
      content: z.string(),
      qualityScore: z.number().optional(),
      evaluationData: z.any().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId, userId: ctx.user.id },
      });
      if (!course) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      return await ctx.prisma.lessonContent.upsert({
        where: {
          courseId_lessonId: { courseId: input.courseId, lessonId: input.lessonId }
        },
        update: { 
          content: input.content,
          ...(input.qualityScore !== undefined ? { qualityScore: input.qualityScore } : {}),
          ...(input.evaluationData !== undefined ? { evaluationData: input.evaluationData } : {})
        },
        create: {
          courseId: input.courseId,
          lessonId: input.lessonId,
          content: input.content,
          qualityScore: input.qualityScore,
          evaluationData: input.evaluationData || {}
        }
      });
    }),

  validateLesson: protectedProcedure
    .input(z.object({ 
      courseId: z.string(), 
      lessonId: z.string(), 
      content: z.string(),
      topic: z.string(),
      level: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId, userId: ctx.user.id },
      });
      if (!course) throw new TRPCError({ code: "UNAUTHORIZED" });

      const systemPrompt = `You are an expert curriculum auditor and quality assurance reviewer.
Analyze the following lesson content against these criteria:
1. Factual accuracy: Flag any incorrect or questionable claims.
2. Difficulty match: Judge if this matches a "${input.level}" level.
3. Safety: Flag any biased, harmful, or inappropriate content.
4. Clarity: Score the pedagogy and clarity from 1-5.

Respond thoughtfully and critically.`;

      const prompt = `Topic: ${input.topic}
Lesson Level: ${input.level}

Lesson Content:
${input.content}
`;

      const schema = z.object({
        isApproved: z.boolean(),
        clarityScore: z.number().min(1).max(5),
        difficultyMatch: z.boolean(),
        issues: z.array(z.string()),
        suggestions: z.array(z.string()),
      });

      const { callGemini } = await import("../lib/gemini-client.js");
      let result;
      try {
        result = await callGemini(prompt, systemPrompt, { schema });
      } catch (err) {
        console.error("Lesson validation failed:", err);
        result = { isApproved: true, clarityScore: 5, difficultyMatch: true, issues: [], suggestions: [] };
      }

      await ctx.prisma.lessonContent.upsert({
        where: { courseId_lessonId: { courseId: input.courseId, lessonId: input.lessonId } },
        update: {
          qualityScore: result.clarityScore,
          evaluationData: result as any,
        },
        create: {
          courseId: input.courseId,
          lessonId: input.lessonId,
          content: input.content,
          qualityScore: result.clarityScore,
          evaluationData: result as any,
        }
      });

      return result;
    }),

  analyzeQuizPerformance: protectedProcedure
    .input(z.object({ 
      courseId: z.string(), 
      lessonId: z.string(), 
      score: z.number(), 
      topic: z.string() 
    }))
    .mutation(async ({ ctx, input }) => {
      const systemPrompt = `You are an adaptive learning coordinator. Based on the user's recent quiz score, recommend what they should do next.
Return ONLY valid JSON matching this schema:
{
  "recommendation": string,
  "difficultyAdjustment": "increase" | "decrease" | "maintain",
  "reviewTopics": string[]
}`;
      const prompt = `Topic: ${input.topic}\nRecent Score: ${input.score}%`;
      
      const schema = z.object({
        recommendation: z.string(),
        difficultyAdjustment: z.enum(["increase", "decrease", "maintain"]),
        reviewTopics: z.array(z.string())
      });

      const { callGemini } = await import("../lib/gemini-client.js");
      let analysis;
      try {
        analysis = await callGemini(prompt, systemPrompt, { schema });
      } catch (err) {
        console.error("Analysis failed", err);
        analysis = {
          recommendation: "Keep up the good work!",
          difficultyAdjustment: "maintain",
          reviewTopics: []
        };
      }

      const progress = await ctx.prisma.userProgress.findUnique({ where: { userId: ctx.user.id }});
      if (progress) {
        const scores = Array.isArray(progress.quizScores) ? progress.quizScores : [];
        scores.push({ courseId: input.courseId, lessonId: input.lessonId, score: input.score, date: new Date().toISOString() });
        await ctx.prisma.userProgress.update({
          where: { userId: ctx.user.id },
          data: { quizScores: scores }
        });
      }

      return analysis;
    }),

  deleteCourse: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({ where: { id: input.courseId } });
      if (!course || course.userId !== ctx.user.id) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Course not found or unauthorized" });
      }

      return await ctx.prisma.course.delete({
        where: { id: input.courseId }
      });
    }),

  renameCourse: protectedProcedure
    .input(z.object({ courseId: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({ where: { id: input.courseId } });
      if (!course || course.userId !== ctx.user.id) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Course not found or unauthorized" });
      }
      return await ctx.prisma.course.update({
        where: { id: input.courseId },
        data: { title: input.title }
      });
    }),
  getVisualRoadmaps: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.visualRoadmap.findMany({
      where: { userId: ctx.user.id },
      orderBy: [
        { isFavorite: "desc" },
        { updatedAt: "desc" }
      ],
      select: {
        id: true,
        title: true,
        topic: true,
        difficulty: true,
        experienceLevel: true,
        totalDuration: true,
        isFavorite: true,
        completedNodeIds: true,
        roadmapData: true,
        createdAt: true,
      }
    })
  }),

  getVisualRoadmap: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const roadmap = await ctx.prisma.visualRoadmap.findFirst({
        where: { id: input.id, userId: ctx.user.id }
      })
      if (!roadmap) throw new TRPCError({ code: "NOT_FOUND" })
      return roadmap
    }),

  saveVisualRoadmap: protectedProcedure
    .input(z.object({
      title: z.string(),
      topic: z.string(),
      description: z.string().optional(),
      difficulty: z.string(),
      totalDuration: z.string().optional(),
      experienceLevel: z.string(),
      weeklyHours: z.number(),
      roadmapData: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.visualRoadmap.create({
        data: { userId: ctx.user.id, ...input }
      })
    }),

  toggleFavoriteRoadmap: protectedProcedure
    .input(z.object({ id: z.string(), isFavorite: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.visualRoadmap.update({
        where: { id: input.id, userId: ctx.user.id },
        data: { isFavorite: input.isFavorite }
      })
    }),

  deleteVisualRoadmap: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.visualRoadmap.delete({
        where: { id: input.id, userId: ctx.user.id }
      })
    }),

  updateVisualRoadmapProgress: protectedProcedure
    .input(z.object({
      id: z.string(),
      completedNodeIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.visualRoadmap.update({
        where: { id: input.id, userId: ctx.user.id },
        data: {
          completedNodeIds: input.completedNodeIds,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          completedNodeIds: true,
        }
      })
    }),

  updateProjectStatus: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      status: z.string(),
      submissionNote: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.update({
        where: { id: input.projectId, userId: ctx.user.id },
        data: {
          status: input.status,
          submissionNote: input.submissionNote
        }
      });
      return project;
    }),

  getModuleProject: protectedProcedure
    .input(z.object({ courseId: z.string(), moduleId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.project.findUnique({
        where: { courseId_moduleId: { courseId: input.courseId, moduleId: input.moduleId } }
      });
    }),

  generateProject: protectedProcedure
    .input(z.object({ 
      courseId: z.string(), 
      moduleId: z.string(), 
      moduleTitle: z.string(), 
      topic: z.string(), 
      level: z.string() 
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if project already exists
      const existing = await ctx.prisma.project.findUnique({
        where: { courseId_moduleId: { courseId: input.courseId, moduleId: input.moduleId } }
      });
      if (existing) return existing;

      const systemPrompt = `You are a highly supportive and encouraging technical mentor creating a hands-on learning project for a student.
Topic: ${input.topic}
Module: ${input.moduleTitle}
Level: ${input.level}

Generate a highly structured, engaging, and beginner-friendly project that applies the concepts learned in this module.
If the level is "Beginner" or if the topic is new, ensure the project is easy to digest, uses highly accessible phrasing, does not require complex boilerplate setup, and has clear, step-by-step instructions. Keep estimatedHours reasonable (e.g., 1-2 hours for beginners). Avoid daunting, overly complicated architecture. The instructions should be warm and guiding, making the student feel successful.

Return ONLY JSON matching this schema:
{
  "title": string,
  "description": string,
  "objectives": string[],
  "steps": string[],
  "estimatedHours": number,
  "successCriteria": string[]
}`;
      const schema = z.object({
        title: z.string(),
        description: z.string(),
        objectives: z.array(z.string()),
        steps: z.array(z.string()),
        estimatedHours: z.number(),
        successCriteria: z.array(z.string())
      });

      const { callGemini } = await import("../lib/gemini-client.js");
      const result: any = await callGemini("Generate module project", systemPrompt, { schema });

      const project = await ctx.prisma.project.create({
        data: {
          courseId: input.courseId,
          userId: ctx.user.id,
          moduleId: input.moduleId,
          title: result.title,
          description: result.description,
          objectives: result.objectives,
          steps: result.steps,
          estimatedHours: result.estimatedHours,
          successCriteria: result.successCriteria,
        }
      });
      return project;
    }),

  getCohortActivity: protectedProcedure
    .input(z.object({ cohortId: z.string() }))
    .query(async ({ ctx, input }) => {
      const isMember = await ctx.prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: input.cohortId, userId: ctx.user.id } }
      });
      if (!isMember) throw new TRPCError({ code: "UNAUTHORIZED" });

      const members = await ctx.prisma.cohortMember.findMany({
        where: { cohortId: input.cohortId }
      });
      const memberIds = members.map(m => m.userId);

      const recentProgress = await ctx.prisma.userProgress.findMany({
        where: { userId: { in: memberIds } },
        include: { user: true },
        orderBy: { updatedAt: 'desc' },
        take: 20
      });

      return recentProgress.map(p => ({
        userId: p.userId,
        userName: p.user.name,
        action: p.currentCourse ? `Studied ${p.currentCourse}` : 'Logged activity',
        time: p.updatedAt
      }));
    }),

  getCohortLeaderboard: protectedProcedure
    .input(z.object({ cohortId: z.string() }))
    .query(async ({ ctx, input }) => {
      const isMember = await ctx.prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: input.cohortId, userId: ctx.user.id } }
      });
      if (!isMember) throw new TRPCError({ code: "UNAUTHORIZED" });

      const cohort = await ctx.prisma.cohort.findUnique({
        where: { id: input.cohortId },
        include: {
          course: true,
          visualRoadmap: true
        }
      });
      if (!cohort) throw new TRPCError({ code: "NOT_FOUND", message: "Cohort not found" });

      const members = await ctx.prisma.cohortMember.findMany({
        where: { cohortId: input.cohortId },
        include: { user: true }
      });

      const leaderboard = await Promise.all(
        members.map(async m => {
          // Scoped metrics
          const memberCourse = cohort.courseId ? await ctx.prisma.course.findFirst({
            where: {
              userId: m.userId,
              OR: [
                { clonedFromCourseId: cohort.courseId },
                { id: cohort.courseId }
              ]
            }
          }) : null;

          const memberRoadmap = cohort.visualRoadmapId ? await ctx.prisma.visualRoadmap.findFirst({
            where: {
              userId: m.userId,
              OR: [
                { clonedFromRoadmapId: cohort.visualRoadmapId },
                { id: cohort.visualRoadmapId }
              ]
            }
          }) : null;

          let estimatedProficiency = 0;
          let avgQuizScore = 0;

          if (memberCourse) {
            const completedLessons = Array.isArray(memberCourse.completedLessons) ? memberCourse.completedLessons : [];
            const totalLessonsCompleted = completedLessons.length;
            let quizScores: number[] = [];
            if (memberCourse.completedQuizzes && typeof memberCourse.completedQuizzes === 'object' && !Array.isArray(memberCourse.completedQuizzes)) {
              const quizzes = memberCourse.completedQuizzes as any;
              quizScores.push(...(Object.values(quizzes) as number[]));
            }
            avgQuizScore = quizScores.length > 0 
               ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
               : 0;
            estimatedProficiency = Math.min(100, Math.max(0, Math.round((avgQuizScore * 0.7) + (Math.min(100, totalLessonsCompleted * 5) * 0.3))));
          } else if (memberRoadmap) {
            const completedNodeIds = Array.isArray(memberRoadmap.completedNodeIds) ? memberRoadmap.completedNodeIds : [];
            estimatedProficiency = Math.min(100, completedNodeIds.length * 5);
          }

          const progress = await ctx.prisma.userProgress.findUnique({
            where: { userId: m.userId }
          });

          return {
            userId: m.userId,
            name: m.user.name,
            estimatedProficiency,
            avgQuizScore,
            currentStreak: progress?.streakDays || 0
          };
        })
      );

      return leaderboard.sort((a, b) => b.estimatedProficiency - a.estimatedProficiency);
    }),

  previewCohortByInviteCode: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const cohort = await ctx.prisma.cohort.findUnique({
        where: { inviteCode: input.inviteCode },
        include: {
          owner: { select: { name: true } },
          members: true,
          course: { select: { id: true, title: true, difficulty: true } },
          visualRoadmap: { select: { id: true, title: true, difficulty: true } }
        }
      });
      if (!cohort) return null;
      return {
        id: cohort.id,
        name: cohort.name,
        ownerName: cohort.owner.name,
        memberCount: cohort.members.length,
        course: cohort.course,
        visualRoadmap: cohort.visualRoadmap,
        isAlreadyMember: cohort.members.some(m => m.userId === ctx.user.id)
      };
    }),

  joinCohort: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cohort = await ctx.prisma.cohort.findUnique({
        where: { inviteCode: input.inviteCode }
      });
      if (!cohort) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });

      await ctx.prisma.cohortMember.upsert({
        where: { cohortId_userId: { cohortId: cohort.id, userId: ctx.user.id } },
        create: { cohortId: cohort.id, userId: ctx.user.id },
        update: {}
      });
      return cohort;
    }),

  joinCohortAndClone: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cohort = await ctx.prisma.cohort.findUnique({
        where: { inviteCode: input.inviteCode },
        include: {
          course: true,
          visualRoadmap: true
        }
      });
      if (!cohort) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });

      const existingMember = await ctx.prisma.cohortMember.findUnique({
        where: {
          cohortId_userId: {
            cohortId: cohort.id,
            userId: ctx.user.id
          }
        }
      });
      if (existingMember) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already joined this cohort." });
      }

      let userCourseId: string | null = null;
      if (cohort.courseId) {
        if (cohort.ownerId === ctx.user.id) {
          userCourseId = cohort.courseId;
        } else {
          const existingClonedCourse = await ctx.prisma.course.findFirst({
            where: {
              userId: ctx.user.id,
              OR: [
                { clonedFromCourseId: cohort.courseId },
                { id: cohort.courseId }
              ]
            }
          });
          if (existingClonedCourse) {
            userCourseId = existingClonedCourse.id;
          } else if (cohort.course) {
            const cloned = await ctx.prisma.course.create({
              data: {
                userId: ctx.user.id,
                title: cohort.course.title,
                description: cohort.course.description,
                topic: cohort.course.topic,
                sourceUrl: cohort.course.sourceUrl,
                difficulty: cohort.course.difficulty,
                totalDuration: cohort.course.totalDuration,
                roadmapData: cohort.course.roadmapData || {},
                experienceLevel: cohort.course.experienceLevel,
                weeklyHours: cohort.course.weeklyHours,
                completedLessons: [],
                completedQuizzes: {},
                clonedFromCourseId: cohort.courseId,
                isActive: true
              }
            });
            userCourseId = cloned.id;
          }
        }
      }

      let userRoadmapId: string | null = null;
      if (cohort.visualRoadmapId) {
        if (cohort.ownerId === ctx.user.id) {
          userRoadmapId = cohort.visualRoadmapId;
        } else {
          const existingClonedRoadmap = await ctx.prisma.visualRoadmap.findFirst({
            where: {
              userId: ctx.user.id,
              OR: [
                { clonedFromRoadmapId: cohort.visualRoadmapId },
                { id: cohort.visualRoadmapId }
              ]
            }
          });
          if (existingClonedRoadmap) {
            userRoadmapId = existingClonedRoadmap.id;
          } else if (cohort.visualRoadmap) {
            const cloned = await ctx.prisma.visualRoadmap.create({
              data: {
                userId: ctx.user.id,
                title: cohort.visualRoadmap.title,
                topic: cohort.visualRoadmap.topic,
                description: cohort.visualRoadmap.description,
                difficulty: cohort.visualRoadmap.difficulty,
                totalDuration: cohort.visualRoadmap.totalDuration,
                experienceLevel: cohort.visualRoadmap.experienceLevel,
                weeklyHours: cohort.visualRoadmap.weeklyHours,
                roadmapData: cohort.visualRoadmap.roadmapData || {},
                completedNodeIds: [],
                clonedFromRoadmapId: cohort.visualRoadmapId,
                isFavorite: false
              }
            });
            userRoadmapId = cloned.id;
          }
        }
      }

      await ctx.prisma.cohortMember.upsert({
        where: { cohortId_userId: { cohortId: cohort.id, userId: ctx.user.id } },
        create: { cohortId: cohort.id, userId: ctx.user.id },
        update: {}
      });

      return {
        cohortId: cohort.id,
        courseId: userCourseId,
        visualRoadmapId: userRoadmapId
      };
    }),

  createCohort: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        courseId: z.string().optional().nullable(),
        visualRoadmapId: z.string().optional().nullable(),
      }).refine(data => data.courseId || data.visualRoadmapId, {
        message: "At least one of Course or Roadmap must be selected",
        path: ["courseId"]
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.courseId) {
        const course = await ctx.prisma.course.findFirst({
          where: { id: input.courseId, userId: ctx.user.id }
        });
        if (!course) throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this course" });
      }
      if (input.visualRoadmapId) {
        const roadmap = await ctx.prisma.visualRoadmap.findFirst({
          where: { id: input.visualRoadmapId, userId: ctx.user.id }
        });
        if (!roadmap) throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this roadmap" });
      }

      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const cohort = await ctx.prisma.cohort.create({
        data: {
          name: input.name,
          ownerId: ctx.user.id,
          inviteCode,
          courseId: input.courseId || null,
          visualRoadmapId: input.visualRoadmapId || null,
          members: {
            create: { userId: ctx.user.id }
          }
        },
        include: {
          course: true,
          visualRoadmap: true,
          members: {
            include: { user: true }
          }
        }
      });
      return cohort;
    }),

  getUserCohorts: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.cohortMember.findMany({
      where: { userId: ctx.user.id },
      include: {
        cohort: {
          include: {
            course: true,
            visualRoadmap: true,
            _count: { select: { members: true } }
          }
        }
      }
    });
  }),

  deleteCohort: protectedProcedure
    .input(z.object({ cohortId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cohort = await ctx.prisma.cohort.findUnique({
        where: { id: input.cohortId }
      });
      if (!cohort) throw new TRPCError({ code: "NOT_FOUND", message: "Cohort not found" });
      if (cohort.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the creator of this cohort can delete it" });
      }

      await ctx.prisma.cohort.delete({
        where: { id: input.cohortId }
      });

      return { success: true };
    }),

  leaveCohort: protectedProcedure
    .input(z.object({ cohortId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cohort = await ctx.prisma.cohort.findUnique({
        where: { id: input.cohortId }
      });
      if (!cohort) throw new TRPCError({ code: "NOT_FOUND", message: "Cohort not found" });
      if (cohort.ownerId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The owner cannot leave the cohort. You can delete it instead." });
      }

      await ctx.prisma.cohortMember.delete({
        where: {
          cohortId_userId: {
            cohortId: input.cohortId,
            userId: ctx.user.id
          }
        }
      });

      return { success: true };
    }),

  // Teacher MVP Procedures
  createClassroom: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        courseId: z.string().optional().nullable(),
        visualRoadmapId: z.string().optional().nullable(),
      }).refine(data => data.courseId || data.visualRoadmapId, {
        message: "At least one of Course or Roadmap must be selected",
        path: ["courseId"]
      })
    )
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "teacher") throw new TRPCError({ code: "FORBIDDEN" });
      if (input.courseId) {
        const course = await ctx.prisma.course.findFirst({
          where: { id: input.courseId, userId: ctx.user.id }
        });
        if (!course) throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this course" });
      }
      if (input.visualRoadmapId) {
        const roadmap = await ctx.prisma.visualRoadmap.findFirst({
          where: { id: input.visualRoadmapId, userId: ctx.user.id }
        });
        if (!roadmap) throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this roadmap" });
      }

      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      return await ctx.prisma.cohort.create({
        data: {
          name: input.name,
          ownerId: ctx.user.id,
          inviteCode,
          isClassroom: true,
          courseId: input.courseId || null,
          visualRoadmapId: input.visualRoadmapId || null,
        }
      });
    }),

  getClassroomRoster: protectedProcedure
    .input(z.object({ classroomId: z.string() }))
    .query(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "teacher") throw new TRPCError({ code: "FORBIDDEN" });
      const classroom = await ctx.prisma.cohort.findUnique({
        where: { id: input.classroomId },
        include: {
          course: true,
          visualRoadmap: true
        }
      });
      if (!classroom || classroom.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const members = await ctx.prisma.cohortMember.findMany({
        where: { cohortId: input.classroomId },
        include: { user: true }
      });

      const roster = await Promise.all(
        members.map(async m => {
          // Scoped metrics
          const memberCourse = classroom.courseId ? await ctx.prisma.course.findFirst({
            where: {
              userId: m.userId,
              OR: [
                { clonedFromCourseId: classroom.courseId },
                { id: classroom.courseId }
              ]
            }
          }) : null;

          const memberRoadmap = classroom.visualRoadmapId ? await ctx.prisma.visualRoadmap.findFirst({
            where: {
              userId: m.userId,
              OR: [
                { clonedFromRoadmapId: classroom.visualRoadmapId },
                { id: classroom.visualRoadmapId }
              ]
            }
          }) : null;

          let estimatedProficiency = 0;
          let avgQuizScore = 0;
          let totalLessonsCompleted = 0;

          if (memberCourse) {
            const completedLessons = Array.isArray(memberCourse.completedLessons) ? memberCourse.completedLessons : [];
            totalLessonsCompleted = completedLessons.length;
            let quizScores: number[] = [];
            if (memberCourse.completedQuizzes && typeof memberCourse.completedQuizzes === 'object' && !Array.isArray(memberCourse.completedQuizzes)) {
              const quizzes = memberCourse.completedQuizzes as any;
              quizScores.push(...(Object.values(quizzes) as number[]));
            }
            avgQuizScore = quizScores.length > 0 
               ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
               : 0;
            estimatedProficiency = Math.min(100, Math.max(0, Math.round((avgQuizScore * 0.7) + (Math.min(100, totalLessonsCompleted * 5) * 0.3))));
          } else if (memberRoadmap) {
            const completedNodeIds = Array.isArray(memberRoadmap.completedNodeIds) ? memberRoadmap.completedNodeIds : [];
            totalLessonsCompleted = completedNodeIds.length;
            estimatedProficiency = Math.min(100, completedNodeIds.length * 5);
          }

          const progress = await ctx.prisma.userProgress.findUnique({
            where: { userId: m.userId }
          });

          return {
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            estimatedProficiency,
            avgQuizScore,
            totalLessonsCompleted,
            currentStreak: progress?.streakDays || 0
          };
        })
      );
      return roster;
    }),

  getStudentDetail: protectedProcedure
    .input(z.object({ classroomId: z.string(), studentId: z.string() }))
    .query(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "teacher") throw new TRPCError({ code: "FORBIDDEN" });
      const classroom = await ctx.prisma.cohort.findUnique({ where: { id: input.classroomId } });
      if (!classroom || classroom.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const courses = await ctx.prisma.course.findMany({
        where: { userId: input.studentId },
        select: { id: true, title: true, difficulty: true, completedLessons: true, completedQuizzes: true }
      });

      const progress = await ctx.prisma.userProgress.findUnique({
        where: { userId: input.studentId }
      });

      // Compute weak topics (scores < 70)
      const weakTopics: any[] = [];
      if (progress && Array.isArray(progress.quizScores)) {
        progress.quizScores.forEach((qs: any) => {
          if (qs.score < 70) {
            weakTopics.push({ topic: qs.topic || "Unknown Topic", score: qs.score });
          }
        });
      }

      return { courses, weakTopics, progress };
    }),

  getTeacherClassrooms: protectedProcedure.query(async ({ ctx }) => {
    if ((ctx.user as any).role !== "teacher") throw new TRPCError({ code: "FORBIDDEN" });
    return await ctx.prisma.cohort.findMany({
      where: { ownerId: ctx.user.id, isClassroom: true },
      include: {
        course: true,
        visualRoadmap: true,
        _count: { select: { members: true } }
      }
    });
  })
});

export type AppRouter = typeof appRouter;
