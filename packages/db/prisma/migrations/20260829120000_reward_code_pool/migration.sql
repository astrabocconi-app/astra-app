-- Voucher pool for rewards (Eventbrite discount codes for our own events).
--
-- Codes are single-use, so each belongs to at most one redemption. The unique
-- constraint on redemptionId is what makes double-issuing impossible even under
-- concurrent redemptions; claiming uses FOR UPDATE SKIP LOCKED so two students
-- pressing redeem at once take different codes rather than blocking.

CREATE TABLE "RewardCode" (
  "id"           TEXT NOT NULL,
  "rewardId"     TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "claimedAt"    TIMESTAMP(3),
  "redemptionId" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardCode_redemptionId_key" ON "RewardCode"("redemptionId");
CREATE UNIQUE INDEX "RewardCode_rewardId_code_key" ON "RewardCode"("rewardId", "code");
CREATE INDEX "RewardCode_rewardId_claimedAt_idx" ON "RewardCode"("rewardId", "claimedAt");

ALTER TABLE "RewardCode"
  ADD CONSTRAINT "RewardCode_rewardId_fkey"
  FOREIGN KEY ("rewardId") REFERENCES "Reward"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RewardCode"
  ADD CONSTRAINT "RewardCode_redemptionId_fkey"
  FOREIGN KEY ("redemptionId") REFERENCES "RewardRedemption"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
