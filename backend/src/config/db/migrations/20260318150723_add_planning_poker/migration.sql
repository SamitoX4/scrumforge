-- CreateTable
CREATE TABLE "PokerSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VOTING',
    "scale" TEXT NOT NULL DEFAULT 'FIBONACCI',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokerVote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PokerVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokerVote_sessionId_userId_key" ON "PokerVote"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "PokerSession" ADD CONSTRAINT "PokerSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokerVote" ADD CONSTRAINT "PokerVote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PokerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokerVote" ADD CONSTRAINT "PokerVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
