import { prisma } from "./db.js";

export async function computeUserMetrics(userId: string) {
  const progress = await prisma.userProgress.findUnique({
    where: { userId }
  });

  const courses = await prisma.course.findMany({
    where: { userId }
  });

  const completedCoursesCount = courses.filter(c => {
     const roadmap = c.roadmapData as any;
     const totalLessons = roadmap?.modules?.reduce((acc: any, m: any) => acc + (m.lessons?.length || 0), 0) || 0;
     return totalLessons > 0 && Array.isArray(c.completedLessons) && c.completedLessons.length >= totalLessons;
  }).length;

  const totalLessonsCompleted = courses.reduce((acc, c) => acc + (Array.isArray(c.completedLessons) ? c.completedLessons.length : 0), 0);
  
  let quizScores: number[] = [];
  courses.forEach(c => {
     if (c.completedQuizzes && typeof c.completedQuizzes === 'object' && !Array.isArray(c.completedQuizzes)) {
        const quizzes = c.completedQuizzes as any;
        quizScores.push(...(Object.values(quizzes) as number[]));
     }
  });
  
  // also get from userProgress.quizScores which we added in part 1
  if (progress && Array.isArray(progress.quizScores)) {
    progress.quizScores.forEach((qs: any) => {
      if (qs && qs.score) quizScores.push(qs.score);
    });
  }

  const avgQuizScore = quizScores.length > 0 
     ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
     : 0;

  const estimatedProficiency = Math.min(100, Math.max(0, Math.round((avgQuizScore * 0.7) + (Math.min(100, totalLessonsCompleted * 5) * 0.3))));

  // Fetch actual timestamped activity from last 7 days
  const courseIds = courses.map(c => c.id);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const messages = courseIds.length > 0 
    ? await prisma.courseMessage.findMany({
        where: {
          courseId: { in: courseIds },
          createdAt: { gte: sevenDaysAgo }
        }
      })
    : [];

  const lessonCompletions: Array<{ lessonId: string; completedAt: Date }> = [];
  const quizCompletions: Array<{ lessonId: string; score: number; completedAt: Date }> = [];

  courses.forEach(c => {
    if (Array.isArray(c.completedLessonsAt)) {
      c.completedLessonsAt.forEach((item: any) => {
        if (item && item.completedAt) {
          lessonCompletions.push({
            lessonId: item.lessonId,
            completedAt: new Date(item.completedAt)
          });
        }
      });
    }
    if (Array.isArray(c.completedQuizzesAt)) {
      c.completedQuizzesAt.forEach((item: any) => {
        if (item && item.completedAt) {
          quizCompletions.push({
            lessonId: item.lessonId,
            score: typeof item.score === "number" ? item.score : 0,
            completedAt: new Date(item.completedAt)
          });
        }
      });
    }
  });

  // Also include quiz scores from UserProgress if any have a date
  if (progress && Array.isArray(progress.quizScores)) {
    progress.quizScores.forEach((qs: any) => {
      if (qs && qs.date) {
        const completedAt = new Date(qs.date);
        // Avoid duplicate scores for the same lesson
        if (!quizCompletions.some(qc => qc.lessonId === qs.lessonId && Math.abs(qc.completedAt.getTime() - completedAt.getTime()) < 60000)) {
          quizCompletions.push({
            lessonId: qs.lessonId,
            score: typeof qs.score === "number" ? qs.score : 0,
            completedAt
          });
        }
      }
    });
  }

  // Generate last 7 days (including today)
  const last7Days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d);
  }

  let totalActivityAcross7Days = 0;
  const activityData = last7Days.map(d => {
    const dayStr = d.toDateString();

    const dayLessonCompletions = lessonCompletions.filter(lc => lc.completedAt.toDateString() === dayStr);
    const dayQuizCompletions = quizCompletions.filter(qc => qc.completedAt.toDateString() === dayStr);
    const dayChats = messages.filter(m => new Date(m.createdAt).toDateString() === dayStr);

    const activityCount = dayLessonCompletions.length + dayQuizCompletions.length + dayChats.length;
    totalActivityAcross7Days += activityCount;

    const quizScoresOnDay = dayQuizCompletions.map(qc => qc.score);
    const avgScoreOnDay = quizScoresOnDay.length > 0
      ? Math.round(quizScoresOnDay.reduce((a, b) => a + b, 0) / quizScoresOnDay.length)
      : 0;

    return {
      name: d.toLocaleDateString("en-US", { weekday: "short" }), // e.g., "Mon", "Tue"
      lessons: activityCount,
      score: avgScoreOnDay
    };
  });

  const activityDataAvailable = totalActivityAcross7Days > 0;

  return {
     currentStreak: progress?.streakDays || 0,
     totalHours: progress?.totalHoursLogged || 0,
     totalLessonsCompleted,
     completedCoursesCount,
     avgQuizScore,
     estimatedProficiency,
     activityData,
     activityDataAvailable
  };
}
