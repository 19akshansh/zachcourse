import { PrismaClient } from "@prisma/client";

export async function recordDailyActivity(prisma: PrismaClient, userId: string) {
  const now = new Date();

  let progress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    progress = await prisma.userProgress.create({
      data: {
        userId,
        currentCourse: "Mastering Python & Smart Software Creation",
        currentWeek: 1,
        streakDays: 1,
        lastSeenAt: now,
        totalHoursLogged: 0.1,
        quizScores: {},
      },
    });
    return progress;
  }

  const lastSeen = progress.lastSeenAt;
  if (!lastSeen) {
    // If lastSeenAt is null, reset/set streak to 1
    progress = await prisma.userProgress.update({
      where: { userId },
      data: {
        streakDays: 1,
        lastSeenAt: now,
      },
    });
    return progress;
  }

  // Normalize dates to midnight to compare calendar days
  const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastSeenNormalized = new Date(lastSeen.getFullYear(), lastSeen.getMonth(), lastSeen.getDate());

  const isSameDay = nowNormalized.getTime() === lastSeenNormalized.getTime();

  if (isSameDay) {
    // Today, no-op
    return progress;
  }

  const diffTime = nowNormalized.getTime() - lastSeenNormalized.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Exactly yesterday, increment streak
    progress = await prisma.userProgress.update({
      where: { userId },
      data: {
        streakDays: progress.streakDays + 1,
        lastSeenAt: now,
      },
    });
  } else {
    // Older than yesterday, reset streak to 1
    progress = await prisma.userProgress.update({
      where: { userId },
      data: {
        streakDays: 1,
        lastSeenAt: now,
      },
    });
  }

  return progress;
}
