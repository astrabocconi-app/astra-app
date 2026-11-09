-- Offer link: an optional https button on a discount (e.g. a Stripe checkout
-- that already carries the student price). Additive and nullable, so the
-- deployed code keeps working before and after.

ALTER TABLE "Offer"
  ADD COLUMN "linkUrl" TEXT,
  ADD COLUMN "linkLabel" TEXT,
  ADD CONSTRAINT "Offer_linkUrl_https" CHECK ("linkUrl" IS NULL OR "linkUrl" LIKE 'https://%');

-- Venue interactions for the backoffice BI page: venue page opens, offer link
-- taps and "directions" taps. Deliberately anonymous (no user id): most venues
-- have no QR redemption, so this is the only signal of interest they get, and
-- it must not become per-student tracking.
CREATE TYPE "VenueInteractionKind" AS ENUM ('VIEW', 'LINK', 'DIRECTIONS');

CREATE TABLE "VenueInteraction" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "offerId" TEXT,
  "kind" "VenueInteractionKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueInteraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenueInteraction_partnerId_createdAt_idx" ON "VenueInteraction"("partnerId", "createdAt");

ALTER TABLE "VenueInteraction"
  ADD CONSTRAINT "VenueInteraction_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
