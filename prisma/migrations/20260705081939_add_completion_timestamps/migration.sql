-- AlterTable
ALTER TABLE "course" ADD COLUMN     "completedLessonsAt" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "completedQuizzesAt" JSONB NOT NULL DEFAULT '[]';
