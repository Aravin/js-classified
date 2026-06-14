ALTER TABLE "listingView"
ALTER COLUMN "viewedDay" TYPE DATE
USING ("viewedDay"::date);