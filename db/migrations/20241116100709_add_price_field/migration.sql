-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "listing_price_idx" ON "listing"("price");
