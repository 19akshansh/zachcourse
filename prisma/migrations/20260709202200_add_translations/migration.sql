-- AlterTable
ALTER TABLE "lesson_content" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "project" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "CourseTranslation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "modules" JSONB NOT NULL,

    CONSTRAINT "CourseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseTranslation_courseId_language_key" ON "CourseTranslation"("courseId", "language");

-- DropIndex
DROP INDEX "lesson_content_courseId_lessonId_key";

-- CreateIndex
CREATE UNIQUE INDEX "lesson_content_courseId_lessonId_language_key" ON "lesson_content"("courseId", "lessonId", "language");

-- DropIndex
DROP INDEX "project_courseId_moduleId_key";

-- CreateIndex
CREATE UNIQUE INDEX "project_courseId_moduleId_language_key" ON "project"("courseId", "moduleId", "language");

-- AddForeignKey
ALTER TABLE "CourseTranslation" ADD CONSTRAINT "CourseTranslation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
