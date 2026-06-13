-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "republishCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "republishedAt" TIMESTAMP(3);
