-- CreateTable
CREATE TABLE "StoryDependency" (
    "id" TEXT NOT NULL,
    "fromStoryId" TEXT NOT NULL,
    "toStoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoryDependency_fromStoryId_toStoryId_type_key" ON "StoryDependency"("fromStoryId", "toStoryId", "type");

-- AddForeignKey
ALTER TABLE "StoryDependency" ADD CONSTRAINT "StoryDependency_fromStoryId_fkey" FOREIGN KEY ("fromStoryId") REFERENCES "UserStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryDependency" ADD CONSTRAINT "StoryDependency_toStoryId_fkey" FOREIGN KEY ("toStoryId") REFERENCES "UserStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryDependency" ADD CONSTRAINT "StoryDependency_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
