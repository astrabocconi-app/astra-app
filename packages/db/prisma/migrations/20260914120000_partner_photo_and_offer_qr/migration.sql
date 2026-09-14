-- Venue detail screen: a wider photo shown when a student taps into a venue
-- (logoKey stays the small square mark used in list/map rows), and a
-- per-offer flag for whether it's redeemed by scanning the student's card QR
-- (the /api/partner/scan flow) versus an informal, untracked discount.

ALTER TABLE "Partner" ADD COLUMN "photoKey" TEXT;
ALTER TABLE "Offer" ADD COLUMN "qrEnabled" BOOLEAN NOT NULL DEFAULT true;
