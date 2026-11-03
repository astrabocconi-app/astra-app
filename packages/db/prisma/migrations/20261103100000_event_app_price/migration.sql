-- In-app ticket price: instead of a percentage off, students who buy through
-- the app pay a fixed price on a hidden Eventbrite ticket type (fees absorbed),
-- unlocked by their personal access code. appDiscountPercent stays, computed
-- from the public price, so apps already in the stores keep showing "-X%".

ALTER TABLE "Event"
  ADD COLUMN "appPriceCents" INTEGER,
  ADD COLUMN "appTicketClassId" TEXT,
  ADD CONSTRAINT "Event_app_price_nonnegative"
    CHECK ("appPriceCents" IS NULL OR "appPriceCents" >= 0);
