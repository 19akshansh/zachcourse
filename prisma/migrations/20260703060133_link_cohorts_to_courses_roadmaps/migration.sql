/*
  Warnings:

  - You are about to drop the `chat_message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roadmap` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- DropForeignKey
ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_chatSessionId_fkey";

-- DropForeignKey
ALTER TABLE "chat_session" DROP CONSTRAINT "chat_session_userId_fkey";

-- DropForeignKey
ALTER TABLE "roadmap" DROP CONSTRAINT "roadmap_userId_fkey";

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "scope" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'student';

-- DropTable
DROP TABLE "chat_message";

-- DropTable
DROP TABLE "chat_session";

-- DropTable
DROP TABLE "roadmap";

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topic" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'Beginner',
    "totalDuration" TEXT,
    "prerequisites" JSONB NOT NULL DEFAULT '[]',
    "experienceLevel" TEXT NOT NULL DEFAULT 'beginner',
    "weeklyHours" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roadmapData" JSONB NOT NULL,
    "completedLessons" JSONB NOT NULL DEFAULT '[]',
    "completedQuizzes" JSONB NOT NULL DEFAULT '{}',
    "currentLessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clonedFromCourseId" TEXT,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_message" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" SERIAL NOT NULL,

    CONSTRAINT "course_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_content" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "qualityScore" INTEGER,
    "evaluationData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visual_roadmap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'Beginner',
    "totalDuration" TEXT,
    "experienceLevel" TEXT NOT NULL DEFAULT 'beginner',
    "weeklyHours" INTEGER NOT NULL DEFAULT 5,
    "roadmapData" JSONB NOT NULL,
    "completedNodeIds" JSONB NOT NULL DEFAULT '[]',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clonedFromRoadmapId" TEXT,

    CONSTRAINT "visual_roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lessonTitle" TEXT NOT NULL,
    "chunk" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "isClassroom" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT,
    "visualRoadmapId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_member" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "estimatedHours" INTEGER NOT NULL,
    "successCriteria" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "submissionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_content_courseId_lessonId_key" ON "lesson_content"("courseId", "lessonId");

-- CreateIndex
CREATE INDEX "lesson_memory_userId_courseId_idx" ON "lesson_memory"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_inviteCode_key" ON "cohort"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_member_cohortId_userId_key" ON "cohort_member"("cohortId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_courseId_moduleId_key" ON "project"("courseId", "moduleId");

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_message" ADD CONSTRAINT "course_message_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_content" ADD CONSTRAINT "lesson_content_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visual_roadmap" ADD CONSTRAINT "visual_roadmap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_memory" ADD CONSTRAINT "lesson_memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_memory" ADD CONSTRAINT "lesson_memory_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_visualRoadmapId_fkey" FOREIGN KEY ("visualRoadmapId") REFERENCES "visual_roadmap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_member" ADD CONSTRAINT "cohort_member_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_member" ADD CONSTRAINT "cohort_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
