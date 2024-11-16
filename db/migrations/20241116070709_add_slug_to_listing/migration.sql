/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `listing` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `listing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "slug" VARCHAR(255) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "listing_slug_key" ON "listing"("slug");
