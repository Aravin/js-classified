/*
  Warnings:

  - The values [A,E,S,D] on the enum `ListingStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ListingStatus_new" AS ENUM ('ACTIVE', 'DRAFT', 'ENDED', 'SUSPENDED', 'DELETED');
ALTER TABLE "listing" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "listing" ALTER COLUMN "status" TYPE "ListingStatus_new" USING ("status"::text::"ListingStatus_new");
ALTER TYPE "ListingStatus" RENAME TO "ListingStatus_old";
ALTER TYPE "ListingStatus_new" RENAME TO "ListingStatus";
DROP TYPE "ListingStatus_old";
ALTER TABLE "listing" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "listing" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
