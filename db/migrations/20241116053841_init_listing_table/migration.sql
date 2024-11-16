-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('A', 'E', 'S', 'D');

-- CreateTable
CREATE TABLE "listing" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'A',
    "categoryId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "listingId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_categoryId_idx" ON "listing"("categoryId");

-- CreateIndex
CREATE INDEX "listing_locationId_idx" ON "listing"("locationId");

-- CreateIndex
CREATE INDEX "listing_status_idx" ON "listing"("status");

-- CreateIndex
CREATE INDEX "image_listingId_idx" ON "image"("listingId");

-- CreateIndex
CREATE INDEX "image_order_idx" ON "image"("order");

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image" ADD CONSTRAINT "image_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
