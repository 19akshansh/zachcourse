import { initTRPC, TRPCError } from "@trpc/server";
import { prisma } from "../lib/db.js";
import { recordDailyActivity } from "../lib/streak.js";
import { auth } from "../lib/auth.js";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { z } from "zod";

const NON_LATIN_LANGUAGES = [
  "hi", "ar", "zh", "ja", "ko", "ru", "he", "el", "th", "fa", 
  "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "as"
];

function isBadLatinTranslation(text: string, lang: string): boolean {
  if (!text) return false;
  if (!NON_LATIN_LANGUAGES.includes(lang)) return false;

  const latinMatch = text.match(/[a-zA-Z]/g);
  const latinCount = latinMatch ? latinMatch.length : 0;

  const alphabeticOnly = text.replace(/[^a-zA-Z\u0900-\u097F\u0600-\u06FF\u4e00-\u9fff\u3040-\u30ff\u3130-\u318f\u0400-\u04FF]/g, "");

  if (alphabeticOnly.length > 5) {
    const latinPct = (latinCount / alphabeticOnly.length) * 100;
    if (latinPct > 70) {
      return true;
    }
  }
  return false;
}

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

  return { prisma, session, req: opts.req };
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

  getTourProgress: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { tourChaptersSeen: true, tourCompletedAt: true, tourContentVersion: true },
    });
    return {
      chaptersSeen: Array.isArray(user?.tourChaptersSeen) ? (user!.tourChaptersSeen as string[]) : [],
      completedAt: user?.tourCompletedAt ?? null,
      contentVersion: user?.tourContentVersion ?? 0,
    };
  }),

  markTourChapterSeen: protectedProcedure
    .input(z.object({ chapterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.id }, select: { tourChaptersSeen: true } });
      const existing = Array.isArray(user?.tourChaptersSeen) ? (user!.tourChaptersSeen as string[]) : [];
      if (!existing.includes(input.chapterId)) {
        await ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: { tourChaptersSeen: [...existing, input.chapterId] },
        });
      }
      return { success: true };
    }),

  markTourCompleted: protectedProcedure
    .input(z.object({ version: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { tourCompletedAt: new Date(), tourContentVersion: input.version },
      });
      return { success: true };
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

  getCourses: protectedProcedure
    .input(z.object({ language: z.string().default("en") }).default({ language: "en" }))
    .query(async ({ ctx, input }) => {
      const courses = await ctx.prisma.course.findMany({
        where: { userId: ctx.user.id },
        orderBy: { updatedAt: "desc" },
        include: {
          courseTranslations: {
            where: { language: input.language }
          }
        }
      });

      return courses.map(c => {
        let isTranslated = true;
        if (input.language !== "en") {
          if (c.courseTranslations && c.courseTranslations.length > 0) {
            const trans = c.courseTranslations[0];
            let isValid = true;
            if (c.roadmapData && typeof c.roadmapData === 'object' && !Array.isArray(c.roadmapData)) {
              const originalModules = (c.roadmapData as any).modules || [];
              const transModules = trans.modules as any[] || [];
              
              if (originalModules.length !== transModules.length) {
                isValid = false;
              } else {
                const originalLessonIds: string[] = [];
                const transLessonIds: string[] = [];

                originalModules.forEach((m: any) => {
                  if (m.lessons) {
                    m.lessons.forEach((l: any) => originalLessonIds.push(l.id));
                  }
                });

                transModules.forEach((m: any) => {
                  if (m.lessons) {
                    m.lessons.forEach((l: any) => transLessonIds.push(l.id));
                  }
                });

                if (originalLessonIds.length !== transLessonIds.length) {
                  isValid = false;
                } else {
                  for (let i = 0; i < originalLessonIds.length; i++) {
                    if (originalLessonIds[i] !== transLessonIds[i]) {
                      isValid = false;
                      break;
                    }
                  }
                }
              }

              // Script validation check for non-Latin target languages
              if (isValid && NON_LATIN_LANGUAGES.includes(input.language)) {
                if (isBadLatinTranslation(trans.title, input.language) || isBadLatinTranslation(trans.description, input.language)) {
                  isValid = false;
                } else {
                  for (const m of transModules) {
                    if (isBadLatinTranslation(m.title, input.language) || isBadLatinTranslation(m.description, input.language)) {
                      isValid = false;
                      break;
                    }
                    if (m.lessons) {
                      for (const l of m.lessons) {
                        if (isBadLatinTranslation(l.title, input.language) || isBadLatinTranslation(l.description, input.language)) {
                          isValid = false;
                          break;
                        }
                      }
                    }
                    if (!isValid) break;
                  }
                }
              }

              if (isValid) {
                c.title = trans.title;
                (c.roadmapData as any).modules = trans.modules;
                if (c.roadmapData && typeof c.roadmapData === 'object' && !Array.isArray(c.roadmapData)) {
                  (c.roadmapData as any).title = trans.title;
                  (c.roadmapData as any).description = trans.description;
                }
              } else {
                isTranslated = false;
              }
            } else {
               c.title = trans.title;
               isTranslated = false;
            }
          } else {
             isTranslated = false;
          }
        }

        const { courseTranslations, ...rest } = c;
        return { ...rest, _isTranslated: isTranslated };
      });
    }),

  issueCertificate: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findFirst({
        where: { id: input.courseId, userId: ctx.user.id },
      });
      if (!course) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      }

      const existing = await ctx.prisma.certificate.findFirst({
        where: { userId: ctx.user.id, courseId: input.courseId }
      });
      if (existing) {
        return existing;
      }

      const completedLessons = (course.completedLessons as string[]) || [];
      let totalLessons = 0;
      const roadmap = course.roadmapData as any;
      if (roadmap && roadmap.modules) {
        roadmap.modules.forEach((mod: any) => {
          if (mod.lessons) totalLessons += mod.lessons.length;
        });
      }

      if (totalLessons === 0 || completedLessons.length < totalLessons) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must complete all lessons to get a certificate.",
        });
      }

      const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase().padEnd(8, "X");
      const certId = `ZC-${randomPart}`;

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id }
      });

      const certificate = await ctx.prisma.certificate.create({
        data: {
          certId,
          userId: ctx.user.id,
          courseId: input.courseId,
          courseTitle: course.title,
          userName: user?.name || "Student",
          recipientEmail: user?.email,
          completionDate: new Date(),
        }
      });

      return certificate;
    }),

  getCertificateByCertId: publicProcedure
    .input(z.object({ certId: z.string() }))
    .query(async ({ ctx, input }) => {
      const certificate = await ctx.prisma.certificate.findUnique({
        where: { certId: input.certId }
      });
      if (!certificate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      }
      return certificate;
    }),

  getCourse: protectedProcedure
    .input(z.object({ courseId: z.string(), language: z.string().optional().default("en") }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findFirst({
        where: { id: input.courseId, userId: ctx.user.id },
        include: {
          messages: {
            take: 50,
            orderBy: { sequence: "desc" },
          },
          // Read from CourseTranslation table
          courseTranslations: {
            where: { language: input.language }
          }
        }
      });
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      course.messages = course.messages.reverse();
      
      // Update user progress currentCourse when they fetch/view a course
      await ctx.prisma.userProgress.upsert({
        where: { userId: ctx.user.id },
        update: { currentCourse: course.title },
        create: { userId: ctx.user.id, currentCourse: course.title, streakDays: 1 }
      }).catch(err => console.error("Failed to update userProgress.currentCourse in getCourse", err));
      
      let isTranslated = true;
      if (input.language !== "en") {
        if (course.courseTranslations && course.courseTranslations.length > 0) {
          const trans = course.courseTranslations[0];
          let isValid = true;
          if (course.roadmapData && typeof course.roadmapData === 'object' && !Array.isArray(course.roadmapData)) {
            const originalModules = (course.roadmapData as any).modules || [];
            const transModules = trans.modules as any[] || [];
            
            if (originalModules.length !== transModules.length) {
              isValid = false;
            } else {
              const originalLessonIds: string[] = [];
              const transLessonIds: string[] = [];

              originalModules.forEach((m: any) => {
                if (m.lessons) {
                  m.lessons.forEach((l: any) => originalLessonIds.push(l.id));
                }
              });

              transModules.forEach((m: any) => {
                if (m.lessons) {
                  m.lessons.forEach((l: any) => transLessonIds.push(l.id));
                }
              });

              if (originalLessonIds.length !== transLessonIds.length) {
                isValid = false;
              } else {
                for (let i = 0; i < originalLessonIds.length; i++) {
                  if (originalLessonIds[i] !== transLessonIds[i]) {
                    isValid = false;
                    break;
                  }
                }
              }
            }

            // Script validation check for non-Latin target languages
            if (isValid && NON_LATIN_LANGUAGES.includes(input.language)) {
              if (isBadLatinTranslation(trans.title, input.language) || isBadLatinTranslation(trans.description, input.language)) {
                isValid = false;
              } else {
                for (const m of transModules) {
                  if (isBadLatinTranslation(m.title, input.language) || isBadLatinTranslation(m.description, input.language)) {
                    isValid = false;
                    break;
                  }
                  if (m.lessons) {
                    for (const l of m.lessons) {
                      if (isBadLatinTranslation(l.title, input.language) || isBadLatinTranslation(l.description, input.language)) {
                        isValid = false;
                        break;
                      }
                    }
                  }
                  if (!isValid) break;
                }
              }
            }
            
            if (isValid) {
              course.title = trans.title;
              course.description = trans.description;
              (course.roadmapData as any).modules = trans.modules;
              if (course.roadmapData && typeof course.roadmapData === 'object' && !Array.isArray(course.roadmapData)) {
                (course.roadmapData as any).title = trans.title;
                (course.roadmapData as any).description = trans.description;
              }
            } else {
              isTranslated = false;
            }
          } else {
             course.title = trans.title;
             course.description = trans.description;
             isTranslated = false;
          }
        } else {
          isTranslated = false;
        }
      }
      
      const { courseTranslations, ...rest } = course;
      return { ...rest, _isTranslated: isTranslated };
    }),

  saveCourseTranslation: protectedProcedure
    .input(z.object({
      courseId: z.string(),
      language: z.string(),
      title: z.string(),
      description: z.string(),
      modules: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify course ownership
      const course = await ctx.prisma.course.findFirst({
        where: { id: input.courseId, userId: ctx.user.id }
      });
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      
      // Completeness check
      if (course.roadmapData && typeof course.roadmapData === 'object' && !Array.isArray(course.roadmapData)) {
        const originalModules = (course.roadmapData as any).modules || [];
        const transModules = input.modules as any[] || [];

        if (originalModules.length !== transModules.length) {
          console.warn(`[Translation Warning] trpc.saveCourseTranslation module count mismatch. Original: ${originalModules.length}, Translated: ${transModules.length}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Translation failed completeness check: module count mismatch"
          });
        }

        const originalLessonIds: string[] = [];
        const transLessonIds: string[] = [];

        originalModules.forEach((m: any) => {
          if (m.lessons) {
            m.lessons.forEach((l: any) => originalLessonIds.push(l.id));
          }
        });

        transModules.forEach((m: any) => {
          if (m.lessons) {
            m.lessons.forEach((l: any) => transLessonIds.push(l.id));
          }
        });

        if (originalLessonIds.length !== transLessonIds.length) {
          console.warn(`[Translation Warning] trpc.saveCourseTranslation lesson count mismatch. Original: ${originalLessonIds.length}, Translated: ${transLessonIds.length}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Translation failed completeness check: lesson count mismatch"
          });
        }

        for (let i = 0; i < originalLessonIds.length; i++) {
          if (originalLessonIds[i] !== transLessonIds[i]) {
            console.warn(`[Translation Warning] trpc.saveCourseTranslation lesson ID mismatch at index ${i}. Original: ${originalLessonIds[i]}, Translated: ${transLessonIds[i]}`);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Translation failed completeness check: lesson ID mismatch at index ${i}`
            });
          }
        }
      }

      // Script validation check for non-Latin target languages
      if (NON_LATIN_LANGUAGES.includes(input.language)) {
        if (isBadLatinTranslation(input.title, input.language) || isBadLatinTranslation(input.description, input.language)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Translation failed Latin script check: course title or description contains too much Latin script"
          });
        }
        const transModules = input.modules as any[] || [];
        for (const m of transModules) {
          if (isBadLatinTranslation(m.title, input.language) || isBadLatinTranslation(m.description, input.language)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Translation failed Latin script check: module "${m.title}" contains too much Latin script`
            });
          }
          if (m.lessons) {
            for (const l of m.lessons) {
              if (isBadLatinTranslation(l.title, input.language) || isBadLatinTranslation(l.description, input.language)) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Translation failed Latin script check: lesson "${l.title}" contains too much Latin script`
                });
              }
            }
          }
        }
      }

      return ctx.prisma.courseTranslation.upsert({
        where: {
          courseId_language: {
            courseId: input.courseId,
            language: input.language
          }
        },
        create: {
          courseId: input.courseId,
          language: input.language,
          title: input.title,
          description: input.description,
          modules: input.modules
        },
        update: {
          title: input.title,
          description: input.description,
          modules: input.modules
        }
      });
    }),

  deleteCourseTranslation: protectedProcedure
    .input(z.object({
      courseId: z.string(),
      language: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify course ownership
      const course = await ctx.prisma.course.findFirst({
        where: { id: input.courseId, userId: ctx.user.id }
      });
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        await ctx.prisma.courseTranslation.delete({
          where: {
            courseId_language: {
              courseId: input.courseId,
              language: input.language
            }
          }
        });
        return { success: true };
      } catch (e) {
        return { success: false, error: "No translation record to delete" };
      }
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
      backgroundContext: z.string().optional(),
      tone: z.string().default("friendly"),
      weeklyHours: z.number().default(5),
      roadmapData: z.any(),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { language, ...courseInput } = input;
      const course = await ctx.prisma.course.create({
        data: {
          userId: ctx.user.id,
          ...courseInput,
          roadmapData: input.roadmapData,
          prerequisites: input.prerequisites,
        }
      });

      const greetings: Record<string, string> = {
        en: "Hey! 👋 I'm your ZachCourse mentor for **{{title}}**. I've built your personalized roadmap — click any lesson on the left to start learning. I'm here to answer any questions about the course or anything else on your mind! What would you like to explore first? 🚀",
        es: "¡Hola! 👋 Soy tu mentor de ZachCourse para **{{title}}**. He creado tu hoja de ruta personalizada. Haz clic en cualquier lección de la izquierda para empezar a aprender. ¡Estoy aquí para responder cualquier pregunta sobre el curso o lo que tengas en mente! ¿Qué te gustaría explorar primero? 🚀",
        fr: "Salut ! 👋 Je suis votre mentor ZachCourse pour **{{title}}**. J'ai créé votre feuille de route personnalisée — cliquez sur n'importe quelle leçon à gauche pour commencer à apprendre. Je suis là pour répondre à toutes vos questions sur le cours ou tout autre sujet en tête ! Qu'aimeriez-vous explorer en premier ? 🚀",
        de: "Hallo! 👋 Ich bin dein ZachCourse-Mentor für **{{title}}**. Ich habe deine personalisierte Roadmap erstellt – klicke links auf eine beliebige Lektion, um mit dem Lernen zu beginnen. Ich bin hier, um all deine Fragen zum Kurs oder zu allem anderen zu beantworten! Was möchtest du als Erstes erkunden? 🚀",
        hi: "अरे! 👋 मैं **{{title}}** के लिए आपका ZachCourse मेंटर हूँ। मैंने आपका व्यक्तिगत रोडमैप तैयार किया है — सीखना शुरू करने के लिए बाईं ओर किसी भी पाठ पर क्लिक करें। मैं यहाँ पाठ्यक्रम या आपके मन में मौजूद किसी भी चीज़ के बारे में आपके प्रश्नों का उत्तर देने के लिए हूँ! आप सबसे पहले क्या तलाशना चाहेंगे? 🚀",
        zh: "嘿！👋 我是你的 ZachCourse 导师，负责 **{{title}}**。我已经为你制定了量身定制的路线图——点击左侧的任意一课即可开始学习。我在这里为你解答有关课程或你脑海中任何其他问题的疑问！你最想先探索什么？ 🚀"
      };
      const template = greetings[language || "en"] || greetings.en;
      const greetingMessage = template.replace("{{title}}", input.title);

      await ctx.prisma.courseMessage.create({
        data: {
          courseId: course.id,
          role: "assistant",
          content: greetingMessage
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

      let isStudyActivity = false;

      if (input.completedLessons) {
        const oldLessons = Array.isArray(course.completedLessons)
          ? (course.completedLessons as string[])
          : [];
        const newLessons = input.completedLessons;

        // 1. Find newly completed lessons
        const newlyCompleted = newLessons.filter(id => !oldLessons.includes(id));
        if (newlyCompleted.length > 0) {
          isStudyActivity = true;
        }
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

        const newlyCompletedQuizzes = Object.keys(newQuizzes).filter(id => oldQuizzes[id] === undefined);
        if (newlyCompletedQuizzes.length > 0) {
          isStudyActivity = true;
        }

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

      if (isStudyActivity) {
        await recordDailyActivity(ctx.prisma, ctx.user.id);
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
    .input(z.object({ courseId: z.string(), lessonId: z.string(), language: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId, userId: ctx.user.id },
      });
      if (!course) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      const content = await ctx.prisma.lessonContent.findUnique({
        where: {
          courseId_lessonId_language: { courseId: input.courseId, lessonId: input.lessonId, language: input.language || "en" }
        }
      });
      return content;
    }),

  saveLessonContent: protectedProcedure
    .input(z.object({ courseId: z.string(), lessonId: z.string(), content: z.string(), language: z.string().optional(),
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
          courseId_lessonId_language: { courseId: input.courseId, lessonId: input.lessonId, language: input.language || "en" }
        },
        update: { 
          content: input.content,
          ...(input.qualityScore !== undefined ? { qualityScore: input.qualityScore } : {}),
          ...(input.evaluationData !== undefined ? { evaluationData: input.evaluationData } : {})
        },
        create: { courseId: input.courseId, lessonId: input.lessonId, content: input.content, language: input.language || "en",
          qualityScore: input.qualityScore,
          evaluationData: input.evaluationData || {}
        }
      });
    }),

  validateLesson: protectedProcedure
    .input(z.object({ courseId: z.string(), lessonId: z.string(), content: z.string(),
      topic: z.string(),
      level: z.string(),
      language: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId, userId: ctx.user.id },
      });
      if (!course) throw new TRPCError({ code: "UNAUTHORIZED" });

      const { LANGUAGE_INSTRUCTIONS } = await import("../lib/tone-options.js");
      const languageInstruction = LANGUAGE_INSTRUCTIONS[input.language || "en"] ?? LANGUAGE_INSTRUCTIONS.en;

      const systemPrompt = `You are an expert curriculum auditor and quality assurance reviewer.
Analyze the following lesson content against these criteria:
1. Factual accuracy: Flag any incorrect or questionable claims.
2. Difficulty match: Judge if this matches a "${input.level}" level.
3. Safety: Flag any biased, harmful, or inappropriate content.
4. Clarity: Score the pedagogy and clarity from 1-5.

Language instruction: ${languageInstruction}

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
        let userKey = ctx.req.headers["x-user-key"] as string | undefined;
        if (userKey === "null" || userKey === "undefined" || userKey === "" || !userKey) userKey = undefined;
        result = await callGemini(prompt, systemPrompt, { schema, apiKey: userKey });
      } catch (err) {
        console.error("Lesson validation failed:", err);
        result = { isApproved: true, clarityScore: 5, difficultyMatch: true, issues: [], suggestions: [] };
      }

      await ctx.prisma.lessonContent.upsert({
        where: { courseId_lessonId_language: { courseId: input.courseId, lessonId: input.lessonId, language: input.language || "en" } },
        update: {
          qualityScore: result.clarityScore,
          evaluationData: result as any,
        },
        create: { courseId: input.courseId, lessonId: input.lessonId, content: input.content, language: input.language || "en",
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
      topic: z.string(),
      language: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { LANGUAGE_INSTRUCTIONS } = await import("../lib/tone-options.js");
      const languageInstruction = LANGUAGE_INSTRUCTIONS[input.language || "en"] ?? LANGUAGE_INSTRUCTIONS.en;

      const systemPrompt = `You are an adaptive learning coordinator. Based on the user's recent quiz score, recommend what they should do next.
Return ONLY valid JSON matching this schema:
{
  "recommendation": string,
  "difficultyAdjustment": "increase" | "decrease" | "maintain",
  "reviewTopics": string[]
}

Language instruction: ${languageInstruction}`;
      const prompt = `Topic: ${input.topic}\nRecent Score: ${input.score}%`;
      
      const schema = z.object({
        recommendation: z.string(),
        difficultyAdjustment: z.enum(["increase", "decrease", "maintain"]),
        reviewTopics: z.array(z.string())
      });

      const { callGemini } = await import("../lib/gemini-client.js");
      let analysis;
      try {
        let userKey = ctx.req.headers["x-user-key"] as string | undefined;
        if (userKey === "null" || userKey === "undefined" || userKey === "" || !userKey) userKey = undefined;
        analysis = await callGemini(prompt, systemPrompt, { schema, apiKey: userKey });
      } catch (err) {
        console.error("Analysis failed", err);
        const language = input.language || "en";
        const fallbackMap: Record<string, string> = {
          en: "Keep up the good work!",
          ar: "واصل العمل الرائع!",
          de: "Weiter so!",
          es: "¡Sigue con el buen trabajo!",
          fr: "Continuez comme ça !",
          hi: "अच्छा काम करते रहें!",
          zh: "继续保持！"
        };
        analysis = {
          recommendation: fallbackMap[language] || "Keep up the good work!",
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
  getVisualRoadmaps: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(6),
      language: z.string().optional().default("en")
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page || 1;
      const pageSize = input?.pageSize || 6;
      const language = input?.language || "en";
      
      const [items, totalCount] = await Promise.all([
        ctx.prisma.visualRoadmap.findMany({
          where: { userId: ctx.user.id },
          orderBy: [
            { isFavorite: "desc" },
            { updatedAt: "desc" }
          ],
          include: {
            visualRoadmapTranslations: {
              where: { language }
            }
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.visualRoadmap.count({
          where: { userId: ctx.user.id }
        })
      ]);

      const mappedItems = items.map(roadmap => {
        let isTranslated = true;
        if (roadmap.visualRoadmapTranslations && roadmap.visualRoadmapTranslations.length > 0) {
            const trans = roadmap.visualRoadmapTranslations[0];
            let isValid = true;
            if (roadmap.roadmapData && typeof roadmap.roadmapData === 'object' && !Array.isArray(roadmap.roadmapData)) {
              const originalNodes = (roadmap.roadmapData as any).nodes || [];
              const transNodes = (trans.roadmapData as any)?.nodes || [];
              if (originalNodes.length !== transNodes.length) {
                isValid = false;
              } else {
                const originalNodeIds = originalNodes.map((n) => n.id);
                const transNodeIds = transNodes.map((n) => n.id);
                for (let i = 0; i < originalNodeIds.length; i++) {
                  if (originalNodeIds[i] !== transNodeIds[i]) {
                    isValid = false;
                    break;
                  }
                }
              }
              if (isValid) {
                const originalEdges = (roadmap.roadmapData as any).edges || [];
                const transEdges = (trans.roadmapData as any)?.edges || [];
                if (originalEdges.length !== transEdges.length) {
                  isValid = false;
                } else {
                  const originalEdgeIds = originalEdges.map((e) => e.id || `${e.source}-${e.target}-${e.type}`);
                  const transEdgeIds = transEdges.map((e) => e.id || `${e.source}-${e.target}-${e.type}`);
                  for (let i = 0; i < originalEdgeIds.length; i++) {
                    if (originalEdgeIds[i] !== transEdgeIds[i]) {
                      isValid = false;
                      break;
                    }
                  }
                }
              }

              if (isValid && NON_LATIN_LANGUAGES.includes(language)) {
                if (isBadLatinTranslation(trans.title, language) || isBadLatinTranslation(trans.description, language)) {
                  isValid = false;
                } else {
                  for (const n of transNodes) {
                    if (isBadLatinTranslation(n.label || "", language) || isBadLatinTranslation(n.description || "", language)) {
                      isValid = false;
                      break;
                    }
                    if (n.concepts) {
                      for (const c of n.concepts) {
                        if (isBadLatinTranslation(c || "", language)) {
                          isValid = false;
                          break;
                        }
                      }
                    }
                    if (!isValid) break;
                  }
                }
              }
              
              if (isValid) {
                roadmap.title = trans.title;
                roadmap.topic = trans.topic;
                if (trans.description) {
                  roadmap.description = trans.description;
                }
                roadmap.roadmapData = trans.roadmapData;
              } else {
                isTranslated = false;
              }
            } else {
               roadmap.title = trans.title;
               roadmap.topic = trans.topic;
               if (trans.description) {
                 roadmap.description = trans.description;
               }
               isTranslated = false;
            }
          } else if (language !== "en") {
            isTranslated = false;
          }
        const { visualRoadmapTranslations, ...rest } = roadmap;
        return { ...rest, _isTranslated: isTranslated };
      });

      return {
        items: mappedItems,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      };
    }),

  getVisualRoadmap: protectedProcedure
    .input(z.object({ id: z.string(), language: z.string().optional().default("en") }))
    .query(async ({ ctx, input }) => {
      const roadmap = await ctx.prisma.visualRoadmap.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          visualRoadmapTranslations: {
            where: { language: input.language }
          }
        }
      });
      if (!roadmap) throw new TRPCError({ code: "NOT_FOUND" });

      let isTranslated = true;
      if (roadmap.visualRoadmapTranslations && roadmap.visualRoadmapTranslations.length > 0) {
          const trans = roadmap.visualRoadmapTranslations[0];
          let isValid = true;
          if (roadmap.roadmapData && typeof roadmap.roadmapData === 'object' && !Array.isArray(roadmap.roadmapData)) {
            const originalNodes = (roadmap.roadmapData as any).nodes || [];
            const transNodes = (trans.roadmapData as any)?.nodes || [];
              if (originalNodes.length !== transNodes.length) {
                isValid = false;
              } else {
                const originalNodeIds = originalNodes.map((n) => n.id);
                const transNodeIds = transNodes.map((n) => n.id);
                for (let i = 0; i < originalNodeIds.length; i++) {
                  if (originalNodeIds[i] !== transNodeIds[i]) {
                    isValid = false;
                    break;
                  }
                }
              }
            if (isValid) {
              const originalEdges = (roadmap.roadmapData as any).edges || [];
              const transEdges = (trans.roadmapData as any)?.edges || [];
                if (originalEdges.length !== transEdges.length) {
                  isValid = false;
                } else {
                  const originalEdgeIds = originalEdges.map((e) => e.id || `${e.source}-${e.target}-${e.type}`);
                  const transEdgeIds = transEdges.map((e) => e.id || `${e.source}-${e.target}-${e.type}`);
                  for (let i = 0; i < originalEdgeIds.length; i++) {
                    if (originalEdgeIds[i] !== transEdgeIds[i]) {
                      isValid = false;
                      break;
                    }
                  }
                }
            }

            if (isValid && NON_LATIN_LANGUAGES.includes(input.language)) {
              if (isBadLatinTranslation(trans.title, input.language) || isBadLatinTranslation(trans.description, input.language)) {
                isValid = false;
              } else {
                for (const n of transNodes) {
                  if (isBadLatinTranslation(n.label || "", input.language) || isBadLatinTranslation(n.description || "", input.language)) {
                    isValid = false;
                    break;
                  }
                  if (n.concepts) {
                    for (const c of n.concepts) {
                      if (isBadLatinTranslation(c || "", input.language)) {
                        isValid = false;
                        break;
                      }
                    }
                  }
                  if (!isValid) break;
                }
              }
            }
            
            if (isValid) {
              roadmap.title = trans.title;
              roadmap.topic = trans.topic;
              if (trans.description) {
                roadmap.description = trans.description;
              }
              roadmap.roadmapData = trans.roadmapData;
            } else {
              isTranslated = false;
            }
          } else {
             roadmap.title = trans.title;
             roadmap.topic = trans.topic;
             if (trans.description) {
               roadmap.description = trans.description;
             }
             isTranslated = false;
          }
        } else if (input.language !== "en") {
          isTranslated = false;
        }

      const { visualRoadmapTranslations, ...rest } = roadmap;
      return { ...rest, _isTranslated: isTranslated };
    }),

  saveVisualRoadmap: protectedProcedure
    .input(z.object({
      title: z.string(),
      topic: z.string(),
      description: z.string().optional(),
      difficulty: z.string(),
      totalDuration: z.string().optional(),
      experienceLevel: z.string(),
      backgroundContext: z.string().optional(),
      weeklyHours: z.number(),
      roadmapData: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.visualRoadmap.create({
        data: { userId: ctx.user.id, ...input }
      })
    }),

  
  deleteVisualRoadmapTranslation: protectedProcedure
    .input(z.object({
      visualRoadmapId: z.string(),
      language: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const roadmap = await ctx.prisma.visualRoadmap.findFirst({
        where: { id: input.visualRoadmapId, userId: ctx.user.id }
      });
      if (!roadmap) throw new TRPCError({ code: "NOT_FOUND" });
      
      return await ctx.prisma.visualRoadmapTranslation.deleteMany({
        where: {
          visualRoadmapId: input.visualRoadmapId,
          language: input.language
        }
      });
    }),

  saveVisualRoadmapTranslation: protectedProcedure
    .input(z.object({
      visualRoadmapId: z.string(),
      language: z.string(),
      title: z.string(),
      topic: z.string(),
      description: z.string().optional().default(""),
      roadmapData: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify roadmap ownership
      const roadmap = await ctx.prisma.visualRoadmap.findFirst({
        where: { id: input.visualRoadmapId, userId: ctx.user.id }
      });
      if (!roadmap) throw new TRPCError({ code: "NOT_FOUND" });
      
      // Completeness check
      if (roadmap.roadmapData && typeof roadmap.roadmapData === 'object' && !Array.isArray(roadmap.roadmapData)) {
        const originalNodes = (roadmap.roadmapData as any).nodes || [];
        const transNodes = (input.roadmapData as any)?.nodes || [];
        if (originalNodes.length !== transNodes.length) {
          console.warn(`[Translation Warning] trpc.saveVisualRoadmapTranslation nodes count mismatch. Original: ${originalNodes.length}, Translated: ${transNodes.length}`);
          throw new Error("Translation failed completeness check: nodes count mismatch");
        }
        const originalNodeIds = originalNodes.map((n) => n.id);
        const transNodeIds = transNodes.map((n) => n.id);
        for (let i = 0; i < originalNodeIds.length; i++) {
          if (originalNodeIds[i] !== transNodeIds[i]) {
            console.warn(`[Translation Warning] trpc.saveVisualRoadmapTranslation node ID mismatch at index ${i}. Original: ${originalNodeIds[i]}, Translated: ${transNodeIds[i]}`);
            throw new Error(`Translation failed completeness check: node ID mismatch at index ${i}`);
          }
        }
      }

      // Script validation check for non-Latin target languages
      if (NON_LATIN_LANGUAGES.includes(input.language)) {
        if (isBadLatinTranslation(input.title, input.language) || isBadLatinTranslation(input.topic, input.language) || (input.description && isBadLatinTranslation(input.description, input.language))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Translation failed Latin script check: roadmap title, topic or description contains too much Latin script"
          });
        }
        const transNodes = (input.roadmapData as any)?.nodes as any[] || [];
        for (const n of transNodes) {
          if (isBadLatinTranslation(n.label || "", input.language) || isBadLatinTranslation(n.description || "", input.language)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Translation failed Latin script check: node "${n.label}" contains too much Latin script`
            });
          }
          if (n.concepts) {
            for (const c of n.concepts) {
              if (isBadLatinTranslation(c || "", input.language)) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Translation failed Latin script check: concept "${c}" contains too much Latin script`
                });
              }
            }
          }
        }
      }

      return ctx.prisma.visualRoadmapTranslation.upsert({
        where: {
          visualRoadmapId_language: {
            visualRoadmapId: input.visualRoadmapId,
            language: input.language
          }
        },
        create: {
          visualRoadmapId: input.visualRoadmapId,
          language: input.language,
          title: input.title,
          topic: input.topic,
          description: input.description,
          roadmapData: input.roadmapData
        },
        update: {
          title: input.title,
          topic: input.topic,
          description: input.description,
          roadmapData: input.roadmapData
        }
      });
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
      const roadmap = await ctx.prisma.visualRoadmap.findUnique({
        where: { id: input.id, userId: ctx.user.id },
        select: { completedNodeIds: true }
      });
      if (roadmap) {
        const oldNodeIds = Array.isArray(roadmap.completedNodeIds) ? (roadmap.completedNodeIds as string[]) : [];
        const newlyCompleted = input.completedNodeIds.filter(id => !oldNodeIds.includes(id));
        if (newlyCompleted.length > 0) {
          await recordDailyActivity(ctx.prisma, ctx.user.id);
        }
      }

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
    .input(z.object({ courseId: z.string(), moduleId: z.string(), language: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.project.findUnique({
        where: { courseId_moduleId_language: { courseId: input.courseId, moduleId: input.moduleId, language: input.language || "en" } }
      });
    }),

  generateProject: protectedProcedure
    .input(z.object({ 
      courseId: z.string(), 
      moduleId: z.string(), 
      moduleTitle: z.string(), 
      topic: z.string(), 
      level: z.string(),
      language: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if project already exists
      const existing = await ctx.prisma.project.findUnique({
        where: { courseId_moduleId_language: { courseId: input.courseId, moduleId: input.moduleId, language: input.language || "en" } }
      });
      if (existing) return existing;

      // Get course details for personalized context and tone
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId }
      });
      const tone = course?.tone || "friendly";
      const bgContext = course?.backgroundContext || "";

      const { TONE_INSTRUCTIONS, LANGUAGE_INSTRUCTIONS } = await import("../lib/tone-options.js");
      const toneInstruction = TONE_INSTRUCTIONS[tone as keyof typeof TONE_INSTRUCTIONS] || TONE_INSTRUCTIONS.friendly;
      const languageInstruction = LANGUAGE_INSTRUCTIONS[input.language || "en"] ?? LANGUAGE_INSTRUCTIONS.en;

      const systemPrompt = `You are a highly supportive and encouraging technical mentor creating a hands-on learning project for a student.
Topic: ${input.topic}
Module: ${input.moduleTitle}
Level: ${input.level}
${bgContext ? `Student's Background & Context: ${bgContext}` : ""}

TONE AND STYLE REQUIREMENT:
You must strictly follow this tone and style throughout the project description, objectives, and steps:
${toneInstruction}

LANGUAGE REQUIREMENT:
${languageInstruction}

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
      let userKey = ctx.req.headers["x-user-key"] as string | undefined;
      if (userKey === "null" || userKey === "undefined" || userKey === "" || !userKey) userKey = undefined;
      const result: any = await callGemini("Generate module project", systemPrompt, { schema, apiKey: userKey });

      const project = await ctx.prisma.project.create({
        data: {
          courseId: input.courseId,
          userId: ctx.user.id,
          moduleId: input.moduleId, language: input.language || "en", title: result.title,
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
    .input(z.object({ 
      cohortId: z.string(),
      page: z.number().default(1),
      pageSize: z.number().default(10),
      language: z.string().optional().default("en")
    }))
    .query(async ({ ctx, input }) => {
      const page = input.page;
      const pageSize = input.pageSize;
      const language = input.language || "en";

      const isMember = await ctx.prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: input.cohortId, userId: ctx.user.id } }
      });
      if (!isMember) throw new TRPCError({ code: "UNAUTHORIZED" });

      const members = await ctx.prisma.cohortMember.findMany({
        where: { cohortId: input.cohortId }
      });
      const memberIds = members.map(m => m.userId);

      const [recentProgress, totalCount] = await Promise.all([
        ctx.prisma.userProgress.findMany({
          where: { userId: { in: memberIds } },
          include: { user: true },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        ctx.prisma.userProgress.count({
          where: { userId: { in: memberIds } }
        })
      ]);

      const courses = await ctx.prisma.course.findMany({
        where: { userId: { in: memberIds } },
        include: {
          courseTranslations: {
            where: { language }
          }
        }
      });

      const items = recentProgress.map(p => {
        let displayCourseName = p.currentCourse;
        if (p.currentCourse) {
          const userCourses = courses.filter(c => c.userId === p.userId);
          const matchingCourse = userCourses.find(c => 
            c.title === p.currentCourse || 
            (c as any).courseTranslations?.some((t: any) => t.title === p.currentCourse)
          );
          if (matchingCourse) {
            const trans = matchingCourse.courseTranslations?.[0];
            displayCourseName = trans ? trans.title : matchingCourse.title;
          }
        }

        return {
          userId: p.userId,
          userName: p.user.name,
          action: displayCourseName ? `Studied ${displayCourseName}` : 'Logged activity',
          time: p.updatedAt
        };
      });

      return {
        items,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      };
    }),

  getCohortLeaderboard: protectedProcedure
    .input(z.object({ 
      cohortId: z.string(),
      page: z.number().default(1),
      pageSize: z.number().default(10)
    }))
    .query(async ({ ctx, input }) => {
      const page = input.page;
      const pageSize = input.pageSize;

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

      const totalCount = await ctx.prisma.cohortMember.count({
        where: { cohortId: input.cohortId }
      });

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

      const sortedLeaderboard = leaderboard.sort((a, b) => b.estimatedProficiency - a.estimatedProficiency);
      const items = sortedLeaderboard.slice((page - 1) * pageSize, page * pageSize);

      return {
        items,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      };
    }),

  previewCohortByInviteCode: protectedProcedure
    .input(z.object({ 
      inviteCode: z.string(),
      language: z.string().optional().default("en")
    }))
    .query(async ({ ctx, input }) => {
      const language = input.language || "en";
      const cohort = await ctx.prisma.cohort.findUnique({
        where: { inviteCode: input.inviteCode },
        include: {
          owner: { select: { name: true } },
          members: true,
          course: { 
            include: {
              courseTranslations: {
                where: { language }
              }
            }
          },
          visualRoadmap: { 
            include: {
              visualRoadmapTranslations: {
                where: { language }
              }
            }
          }
        }
      });
      if (!cohort) return null;

      if (cohort.course) {
        const trans = (cohort.course as any).courseTranslations?.[0];
        if (trans) {
          cohort.course.title = trans.title;
        }
      }
      if (cohort.visualRoadmap) {
        const trans = (cohort.visualRoadmap as any).visualRoadmapTranslations?.[0];
        if (trans) {
          cohort.visualRoadmap.title = trans.title;
        }
      }

      return {
        id: cohort.id,
        name: cohort.name,
        ownerName: cohort.owner.name,
        memberCount: cohort.members.length,
        course: cohort.course ? {
          id: cohort.course.id,
          title: cohort.course.title,
          difficulty: cohort.course.difficulty
        } : null,
        visualRoadmap: cohort.visualRoadmap ? {
          id: cohort.visualRoadmap.id,
          title: cohort.visualRoadmap.title,
          difficulty: cohort.visualRoadmap.difficulty
        } : null,
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
    .input(z.object({
      inviteCode: z.string(),
      experienceLevel: z.string().optional(),
      backgroundContext: z.string().optional(),
      tone: z.string().optional(),
    }))
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
            let roadmapData = cohort.course.roadmapData;
            let title = cohort.course.title;
            let description = cohort.course.description;
            let difficulty = cohort.course.difficulty;
            let experienceLevel = input.experienceLevel || cohort.course.experienceLevel;
            let backgroundContext = input.backgroundContext !== undefined ? input.backgroundContext : cohort.course.backgroundContext;
            let tone = input.tone || cohort.course.tone;

            if (input.experienceLevel || input.backgroundContext || input.tone) {
              try {
                const { generateRoadmapContent } = await import("./agents/roadmap-agent.js");
                const generated = await generateRoadmapContent({
                  topic: cohort.course.topic,
                  experienceLevel,
                  backgroundContext: backgroundContext || "",
                  weeklyHours: cohort.course.weeklyHours,
                  sourceUrl: cohort.course.sourceUrl || "",
                  tone,
                  referenceRoadmapData: cohort.course.roadmapData,
                });
                if (generated) {
                  roadmapData = generated;
                  title = generated.title || title;
                  description = generated.description || description;
                  difficulty = generated.difficulty || difficulty;
                }
              } catch (err) {
                console.error("Personalized course regeneration failed, falling back to original roadmap data:", err);
              }
            }

            const cloned = await ctx.prisma.course.create({
              data: {
                userId: ctx.user.id,
                title,
                description,
                topic: cohort.course.topic,
                sourceUrl: cohort.course.sourceUrl,
                difficulty,
                totalDuration: cohort.course.totalDuration,
                roadmapData: roadmapData || {},
                experienceLevel,
                backgroundContext,
                tone,
                weeklyHours: cohort.course.weeklyHours,
                completedLessons: [],
                completedQuizzes: {},
                clonedFromCourseId: cohort.courseId,
                isActive: true
              }
            });
            userCourseId = cloned.id;

            // Welcome message for personalized regenerated course
            const welcomeMessage = `Hey! 👋 I've generated your personalized study guide for **${title}** based on your background and preferences. Let's make this journey amazing! 🚀`;
            await ctx.prisma.courseMessage.create({
              data: {
                courseId: cloned.id,
                role: "assistant",
                content: welcomeMessage,
              }
            });
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
            let roadmapData = cohort.visualRoadmap.roadmapData;
            let title = cohort.visualRoadmap.title;
            let description = cohort.visualRoadmap.description;
            let difficulty = cohort.visualRoadmap.difficulty;
            let experienceLevel = input.experienceLevel || cohort.visualRoadmap.experienceLevel;
            let backgroundContext = input.backgroundContext !== undefined ? input.backgroundContext : cohort.visualRoadmap.backgroundContext;
            let tone = input.tone || cohort.visualRoadmap.tone;

            if (input.experienceLevel || input.backgroundContext || input.tone) {
              try {
                const { generateVisualRoadmapContent } = await import("./agents/roadmap-agent.js");
                const generated = await generateVisualRoadmapContent({
                  topic: cohort.visualRoadmap.topic,
                  experienceLevel,
                  backgroundContext: backgroundContext || "",
                  weeklyHours: cohort.visualRoadmap.weeklyHours,
                  sourceUrl: "",
                  tone,
                  referenceRoadmapData: cohort.visualRoadmap.roadmapData,
                });
                if (generated) {
                  roadmapData = generated;
                  title = generated.title || title;
                  description = generated.description || description;
                  difficulty = generated.difficulty || difficulty;
                }
              } catch (err) {
                console.error("Personalized visual roadmap regeneration failed, falling back to original roadmap data:", err);
              }
            }

            const cloned = await ctx.prisma.visualRoadmap.create({
              data: {
                userId: ctx.user.id,
                title,
                topic: cohort.visualRoadmap.topic,
                description,
                difficulty,
                totalDuration: cohort.visualRoadmap.totalDuration,
                experienceLevel,
                backgroundContext,
                tone,
                weeklyHours: cohort.visualRoadmap.weeklyHours,
                roadmapData: roadmapData || {},
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

  regenerateClonedCohortContent: protectedProcedure
    .input(z.object({
      id: z.string(),
      type: z.enum(["course", "roadmap"]),
      experienceLevel: z.string(),
      backgroundContext: z.string().optional(),
      tone: z.string().optional(),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "course") {
        const course = await ctx.prisma.course.findFirst({
          where: { id: input.id, userId: ctx.user.id }
        });
        if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Cloned course not found" });

        const { generateRoadmapContent } = await import("./agents/roadmap-agent.js");
        const generated = await generateRoadmapContent({
          topic: course.topic,
          experienceLevel: input.experienceLevel,
          backgroundContext: input.backgroundContext || "",
          weeklyHours: course.weeklyHours,
          sourceUrl: course.sourceUrl || "",
          tone: input.tone || course.tone || "friendly",
          referenceRoadmapData: course.roadmapData,
          language: input.language,
        });

        const updatedCourse = await ctx.prisma.course.update({
          where: { id: input.id },
          data: {
            roadmapData: generated || {},
            experienceLevel: input.experienceLevel,
            backgroundContext: input.backgroundContext || null,
            tone: input.tone || course.tone || "friendly",
            difficulty: (generated as any)?.difficulty || "Beginner",
            title: (generated as any)?.title || course.title,
            description: (generated as any)?.description || course.description,
            completedLessons: [],
            completedQuizzes: {},
          }
        });

        const welcomeTemplates: Record<string, string> = {
          en: "Hey! 👋 I've regenerated your **{{title}}** roadmap specifically tailored to your background context ({{level}} level). Let's start learning! 🚀",
          es: "¡Hola! 👋 He regenerado tu hoja de ruta de **{{title}}** específicamente adaptada a tu contexto de fondo (nivel {{level}}). ¡Empecemos a aprender! 🚀",
          fr: "Salut ! 👋 J'ai régénéré votre feuille de route **{{title}}** spécifiquement adaptée à votre contexte (niveau {{level}}). Commençons à apprendre ! 🚀",
          de: "Hallo! 👋 Ich habe deine **{{title}}** Roadmap speziell auf deinen Hintergrund (Level {{level}}) angepasst. Lass uns mit dem Lernen beginnen! 🚀",
          hi: "अरे! 👋 मैंने आपके पृष्ठभूमि संदर्भ ({{level}} स्तर) के लिए विशेष रूप से तैयार किए गए आपके **{{title}}** रोडमैप को पुनर्जीवित किया है। आइए सीखना शुरू करें! 🚀",
          zh: "嘿！👋 我已经重新生成了你的 **{{title}}** 路线图，特别适合你的背景情况（{{level}} 级别）。让我们开始学习吧！🚀"
        };
        const template = welcomeTemplates[input.language || "en"] || welcomeTemplates.en;
        const welcomeMessage = template.replace("{{title}}", updatedCourse.title).replace("{{level}}", input.experienceLevel);

        await ctx.prisma.courseMessage.create({
          data: {
            courseId: course.id,
            role: "assistant",
            content: welcomeMessage
          }
        });

        return { type: "course", data: updatedCourse };
      } else {
        const roadmap = await ctx.prisma.visualRoadmap.findFirst({
          where: { id: input.id, userId: ctx.user.id }
        });
        if (!roadmap) throw new TRPCError({ code: "NOT_FOUND", message: "Cloned visual roadmap not found" });

        const { generateVisualRoadmapContent } = await import("./agents/roadmap-agent.js");
        const generated = await generateVisualRoadmapContent({
          topic: roadmap.topic,
          experienceLevel: input.experienceLevel,
          backgroundContext: input.backgroundContext || "",
          weeklyHours: roadmap.weeklyHours,
          sourceUrl: "",
          tone: input.tone || roadmap.tone || "friendly",
          referenceRoadmapData: roadmap.roadmapData,
          language: input.language,
        });

        const updatedRoadmap = await ctx.prisma.visualRoadmap.update({
          where: { id: input.id },
          data: {
            roadmapData: generated || {},
            experienceLevel: input.experienceLevel,
            backgroundContext: input.backgroundContext || null,
            tone: input.tone || roadmap.tone || "friendly",
            difficulty: (generated as any)?.difficulty || "Beginner",
            title: (generated as any)?.title || roadmap.title,
            description: (generated as any)?.description || roadmap.description,
            completedNodeIds: [],
          }
        });

        return { type: "roadmap", data: updatedRoadmap };
      }
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

  getUserCohorts: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(8),
      language: z.string().optional().default("en")
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page || 1;
      const pageSize = input?.pageSize || 8;
      const language = input?.language || "en";
      
      const [items, totalCount] = await Promise.all([
        ctx.prisma.cohortMember.findMany({
          where: { userId: ctx.user.id },
          include: {
            cohort: {
              include: {
                course: {
                  include: {
                    courseTranslations: {
                      where: { language }
                    }
                  }
                },
                visualRoadmap: {
                  include: {
                    visualRoadmapTranslations: {
                      where: { language }
                    }
                  }
                },
                _count: { select: { members: true } }
              }
            }
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.cohortMember.count({
          where: { userId: ctx.user.id }
        })
      ]);

      const mappedItems = items.map(item => {
        const cohort = item.cohort;
        if (cohort) {
          if (cohort.course) {
            const trans = (cohort.course as any).courseTranslations?.[0];
            if (trans) {
              cohort.course.title = trans.title;
              cohort.course.description = trans.description;
            }
            delete (cohort.course as any).courseTranslations;
          }
          if (cohort.visualRoadmap) {
            const trans = (cohort.visualRoadmap as any).visualRoadmapTranslations?.[0];
            if (trans) {
              cohort.visualRoadmap.title = trans.title;
              cohort.visualRoadmap.description = trans.description;
            }
            delete (cohort.visualRoadmap as any).visualRoadmapTranslations;
          }
        }
        return item;
      });

      return {
        items: mappedItems,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      };
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
    .input(z.object({ 
      classroomId: z.string(),
      page: z.number().default(1),
      pageSize: z.number().default(10)
    }))
    .query(async ({ ctx, input }) => {
      const page = input.page;
      const pageSize = input.pageSize;

      if ((ctx.user as any).role !== "teacher") throw new TRPCError({ code: "FORBIDDEN" });
      const classroom = await ctx.prisma.cohort.findUnique({
        where: { id: input.classroomId },
        include: {
          course: true,
          visualRoadmap: true
        }
      });
      if (!classroom || classroom.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const totalCount = await ctx.prisma.cohortMember.count({
        where: { cohortId: input.classroomId }
      });

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
      
      const sortedRoster = roster.sort((a, b) => b.estimatedProficiency - a.estimatedProficiency);
      const items = sortedRoster.slice((page - 1) * pageSize, page * pageSize);

      return {
        items,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      };
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

  getTeacherClassrooms: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(8),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page || 1;
      const pageSize = input?.pageSize || 8;
      
      if ((ctx.user as any).role !== "teacher") throw new TRPCError({ code: "FORBIDDEN" });
      
      const [items, totalCount] = await Promise.all([
        ctx.prisma.cohort.findMany({
          where: { ownerId: ctx.user.id, isClassroom: true },
          include: {
            course: true,
            visualRoadmap: true,
            _count: { select: { members: true } }
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.cohort.count({
          where: { ownerId: ctx.user.id, isClassroom: true }
        })
      ]);

      return {
        items,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      };
    }),

  updateMyBio: protectedProcedure
    .input(z.object({ bio: z.string().max(160, "Bio must be 160 characters or less") }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { bio: input.bio }
      });
    }),

  unlinkSocialProvider: protectedProcedure
    .input(z.object({ provider: z.enum(["discord", "github"]) }))
    .mutation(async ({ ctx, input }) => {
      const accounts = await ctx.prisma.account.findMany({
        where: { userId: ctx.user.id }
      });

      if (accounts.length <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot unlink your only login method."
        });
      }

      await ctx.prisma.socialLink.deleteMany({
        where: { userId: ctx.user.id, provider: input.provider }
      });

      await ctx.prisma.account.deleteMany({
        where: { userId: ctx.user.id, providerId: input.provider }
      });

      return { success: true };
    }),

  getMySocialLinks: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { bio: true }
      });
      const socialLinks = await ctx.prisma.socialLink.findMany({
        where: { userId: ctx.user.id }
      });
      
      const accounts = await ctx.prisma.account.findMany({
        where: { userId: ctx.user.id }
      });
      const accountProviders = accounts.map(a => a.providerId);
      const mergedLinks = [...socialLinks];

      for (const provider of ["github", "discord"]) {
        if (accountProviders.includes(provider) && !mergedLinks.some(l => l.provider === provider)) {
          mergedLinks.push({
            id: `synthetic_${provider}`,
            provider,
            externalUsername: null,
            profileUrl: null,
            userId: ctx.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any);
        }
      }

      return {
        bio: user?.bio || "",
        socialLinks: mergedLinks
      };
    }),

  getCohortMemberProfile: protectedProcedure
    .input(z.object({ cohortId: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const isCallerMember = await ctx.prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: input.cohortId, userId: ctx.user.id } }
      });
      if (!isCallerMember) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "You are not a member of this cohort" });
      }

      const isTargetMember = await ctx.prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: input.cohortId, userId: input.userId } }
      });
      if (!isTargetMember) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Target user is not a member of this cohort" });
      }

      const targetUser = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          name: true,
          bio: true,
          socialLinks: true
        }
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const cohort = await ctx.prisma.cohort.findUnique({
        where: { id: input.cohortId }
      });
      let role = "Member";
      if (cohort) {
        if (cohort.ownerId === input.userId) {
          role = cohort.isClassroom ? "Teacher" : "Owner";
        } else {
          role = cohort.isClassroom ? "Student" : "Student";
        }
      }

      return {
        name: targetUser.name,
        bio: targetUser.bio || "",
        socialLinks: targetUser.socialLinks,
        role: role
      };
    })
});

export type AppRouter = typeof appRouter;
