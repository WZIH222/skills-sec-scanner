-- AlterTable
ALTER TABLE "scans" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed';

-- CreateIndex
CREATE INDEX "scans_status_idx" ON "scans"("status");
