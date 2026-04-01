-- AlterTable
ALTER TABLE "scans" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "scans_parentId_idx" ON "scans"("parentId");
