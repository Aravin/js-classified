-- CreateEnum
CREATE TYPE "RewardAction" AS ENUM (
    'DAILY_LOGIN',
    'LISTING_PUBLISHED',
    'LISTING_REPUBLISHED',
    'PROFILE_COMPLETED'
);

-- AlterTable
ALTER TABLE "user"
ADD COLUMN     "rewardPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rewardEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" "RewardAction" NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "dedupeKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_rewardPoints_idx" ON "user"("rewardPoints");

-- CreateIndex
CREATE UNIQUE INDEX "rewardEvent_dedupeKey_key" ON "rewardEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "rewardEvent_userId_createdAt_idx" ON "rewardEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "rewardEvent_action_createdAt_idx" ON "rewardEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "rewardEvent_sourceType_sourceId_idx" ON "rewardEvent"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "rewardEvent" ADD CONSTRAINT "rewardEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;