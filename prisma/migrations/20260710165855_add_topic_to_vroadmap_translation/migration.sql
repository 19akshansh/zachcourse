-- CreateTable
CREATE TABLE "visual_roadmap_translation" (
    "id" TEXT NOT NULL,
    "visualRoadmapId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "roadmapData" JSONB NOT NULL,

    CONSTRAINT "visual_roadmap_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visual_roadmap_translation_visualRoadmapId_language_key" ON "visual_roadmap_translation"("visualRoadmapId", "language");

-- AddForeignKey
ALTER TABLE "visual_roadmap_translation" ADD CONSTRAINT "visual_roadmap_translation_visualRoadmapId_fkey" FOREIGN KEY ("visualRoadmapId") REFERENCES "visual_roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
