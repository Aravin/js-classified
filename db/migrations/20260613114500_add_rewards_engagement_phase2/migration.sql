-- AlterEnum
ALTER TYPE "RewardAction" ADD VALUE 'LISTING_UNIQUE_VIEW';
ALTER TYPE "RewardAction" ADD VALUE 'BUYER_FEEDBACK_SUBMITTED';
ALTER TYPE "RewardAction" ADD VALUE 'BUYER_FEEDBACK_RECEIVED';

-- CreateTable
CREATE TABLE "listingView" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "viewerUserId" INTEGER,
    "viewerKey" TEXT NOT NULL,
    "viewedDay" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listingView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactReveal" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactReveal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listingFeedback" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listingView_listingId_viewerKey_viewedDay_key" ON "listingView"("listingId", "viewerKey", "viewedDay");

-- CreateIndex
CREATE INDEX "listingView_listingId_createdAt_idx" ON "listingView"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "listingView_viewerUserId_createdAt_idx" ON "listingView"("viewerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contactReveal_listingId_buyerId_key" ON "contactReveal"("listingId", "buyerId");

-- CreateIndex
CREATE INDEX "contactReveal_sellerId_createdAt_idx" ON "contactReveal"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "listingFeedback_listingId_buyerId_key" ON "listingFeedback"("listingId", "buyerId");

-- CreateIndex
CREATE INDEX "listingFeedback_sellerId_createdAt_idx" ON "listingFeedback"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "listingFeedback_listingId_createdAt_idx" ON "listingFeedback"("listingId", "createdAt");

-- AddForeignKey
ALTER TABLE "listingView" ADD CONSTRAINT "listingView_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listingView" ADD CONSTRAINT "listingView_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactReveal" ADD CONSTRAINT "contactReveal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactReveal" ADD CONSTRAINT "contactReveal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactReveal" ADD CONSTRAINT "contactReveal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listingFeedback" ADD CONSTRAINT "listingFeedback_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listingFeedback" ADD CONSTRAINT "listingFeedback_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listingFeedback" ADD CONSTRAINT "listingFeedback_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;