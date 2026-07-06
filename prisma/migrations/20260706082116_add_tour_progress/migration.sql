-- AlterTable
ALTER TABLE "user" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "tourChaptersSeen" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tourCompletedAt" TIMESTAMP(3),
ADD COLUMN     "tourContentVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "social_link" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalUsername" TEXT,
    "profileUrl" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_link_userId_provider_key" ON "social_link"("userId", "provider");

-- AddForeignKey
ALTER TABLE "social_link" ADD CONSTRAINT "social_link_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
