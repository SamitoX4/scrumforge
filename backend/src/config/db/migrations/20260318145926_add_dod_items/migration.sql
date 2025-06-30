-- CreateTable
CREATE TABLE "DodItem" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DodItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DodItem" ADD CONSTRAINT "DodItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
