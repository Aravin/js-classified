-- CreateTable
CREATE TABLE "location" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "dist" TEXT,
    "state" TEXT,
    "state_code" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "pincode" TEXT,
    "loc_type" TEXT,
    "coords" TEXT,
    "bbox" TEXT,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);
