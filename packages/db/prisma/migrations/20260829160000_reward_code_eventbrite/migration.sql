-- Track where an auto-generated voucher came from.
--
-- Codes can now be created straight on Eventbrite from the backoffice. Storing
-- the discount id means "remove unused codes" can revoke them on Eventbrite too
-- — otherwise we'd delete our row and leave a live, redeemable discount behind.
-- Both columns stay NULL for codes pasted in by hand.

ALTER TABLE "RewardCode" ADD COLUMN "externalId" TEXT;
ALTER TABLE "RewardCode" ADD COLUMN "externalEventId" TEXT;

CREATE UNIQUE INDEX "RewardCode_externalId_key" ON "RewardCode"("externalId");

-- Per-account redemption cap. Stock limits the total handed out across everyone;
-- this limits how many one student can take, so a single account can't drain the
-- pool of free-ticket codes. NULL keeps the existing behaviour (no limit).
ALTER TABLE "Reward" ADD COLUMN "perUserLimit" INTEGER;

-- Counting a student's prior redemptions is now on the redeem path.
CREATE INDEX "RewardRedemption_userId_rewardId_idx"
  ON "RewardRedemption"("userId", "rewardId");
