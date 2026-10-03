-- In-app ticket discounts: an event can be linked to its Eventbrite event and
-- give students who buy through the app a percentage off. Each student gets a
-- personal single-use Eventbrite code, created on demand and remembered here.

ALTER TABLE "Event"
  ADD COLUMN "eventbriteEventId" TEXT,
  ADD COLUMN "appDiscountPercent" INTEGER,
  ADD COLUMN "appDiscountLimit" INTEGER,
  ADD CONSTRAINT "Event_app_discount_percent_range"
    CHECK ("appDiscountPercent" IS NULL OR "appDiscountPercent" BETWEEN 1 AND 100),
  ADD CONSTRAINT "Event_app_discount_limit_positive"
    CHECK ("appDiscountLimit" IS NULL OR "appDiscountLimit" > 0);

CREATE TABLE "EventAppDiscount" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "eventbriteDiscountId" TEXT NOT NULL,
  "percentOff" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventAppDiscount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventAppDiscount_eventId_userId_key" ON "EventAppDiscount"("eventId", "userId");
CREATE INDEX "EventAppDiscount_eventId_idx" ON "EventAppDiscount"("eventId");

ALTER TABLE "EventAppDiscount"
  ADD CONSTRAINT "EventAppDiscount_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAppDiscount"
  ADD CONSTRAINT "EventAppDiscount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
