-- CreateTable
CREATE TABLE "location" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "village" TEXT,
    "dist" TEXT,
    "state" TEXT,
    "state_code" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "pincode" TEXT,
    "location" TEXT,
    "bbox" TEXT,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);
