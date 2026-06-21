/*
  Warnings:

  - A unique constraint covering the columns `[externalLink]` on the table `listing` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "externalLink" VARCHAR(512);

-- CreateTable
CREATE TABLE "crawlerLog" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetName" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "listingsAdded" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "crawlerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawlerLog_timestamp_idx" ON "crawlerLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "listing_externalLink_key" ON "listing"("externalLink");

-- CreateIndex
CREATE INDEX "listing_externalLink_idx" ON "listing"("externalLink");
