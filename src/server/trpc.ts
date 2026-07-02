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
      return await ctx.prisma.course.update({
        where: { id: courseId, userId: ctx.user.id },
        data: {
          ...data,
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
});

export type AppRouter = typeof appRouter;
