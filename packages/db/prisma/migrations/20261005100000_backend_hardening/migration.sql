-- Backend hardening (audit 2026-10): shared rate limiting, re-registration
-- tombstone, Eventbrite revocation queue, push receipts, redeem idempotency,
-- news push dedupe, fail-safe CHECK constraints, one active catalogue, and the
-- missing tracks for BIG, BGL and CLEACC.
--
-- Everything here is additive or a constraint that production data already
-- satisfies (verified with SELECTs before writing: 0 zero-delta ledger rows, 0
-- wrong-signed earn/spend rows, 0 bad rewards/offers/events, exactly 1 active
-- catalogue).

-- ── User: tombstone of a deleted account's email ──────────────────────────────
ALTER TABLE "User" ADD COLUMN "emailHash" TEXT;
CREATE INDEX "User_emailHash_idx" ON "User"("emailHash");

-- ── Better Auth rate limit counters (rateLimit.storage = "database") ──────────
CREATE TABLE "RateLimit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- ── Per-key throttle events (OTP emails per address, chat questions) ──────────
CREATE TABLE "RateEvent" (
  "id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RateEvent_bucket_key_createdAt_idx" ON "RateEvent"("bucket", "key", "createdAt");
CREATE INDEX "RateEvent_createdAt_idx" ON "RateEvent"("createdAt");

-- ── Eventbrite discounts that still have to be revoked ────────────────────────
CREATE TABLE "EventbriteRevocation" (
  "id" TEXT NOT NULL,
  "discountId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventbriteRevocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventbriteRevocation_discountId_key" ON "EventbriteRevocation"("discountId");

-- ── Expo push tickets awaiting a delivery receipt ─────────────────────────────
CREATE TABLE "PushReceipt" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PushReceipt_createdAt_idx" ON "PushReceipt"("createdAt");

-- ── Redeem idempotency + news push dedupe ─────────────────────────────────────
ALTER TABLE "RewardRedemption" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "RewardRedemption_userId_idempotencyKey_key"
  ON "RewardRedemption"("userId", "idempotencyKey");

ALTER TABLE "NewsPost" ADD COLUMN "pushedAt" TIMESTAMP(3);

-- ── CHECK constraints: make the ledger and catalogue fail-safe ────────────────
-- The ledger is append-only (trigger), so a wrong-signed or zero row can never
-- be corrected afterwards; refuse it at the door instead. ADMIN_ADJUSTMENT and
-- OTHER may go either way (refunds and manual deductions).
ALTER TABLE "PointsLedgerEntry"
  ADD CONSTRAINT "PointsLedgerEntry_delta_nonzero" CHECK ("delta" <> 0),
  ADD CONSTRAINT "PointsLedgerEntry_delta_sign_by_source" CHECK (
    ("source"::text IN ('SIGNUP', 'PARTNER_SCAN', 'EVENT_CHECKIN') AND "delta" > 0)
    OR ("source"::text = 'REWARD_REDEMPTION' AND "delta" < 0)
    OR "source"::text IN ('ADMIN_ADJUSTMENT', 'OTHER')
  );

ALTER TABLE "Reward"
  ADD CONSTRAINT "Reward_costPoints_nonneg" CHECK ("costPoints" >= 0),
  ADD CONSTRAINT "Reward_stock_nonneg" CHECK ("stock" IS NULL OR "stock" >= 0),
  ADD CONSTRAINT "Reward_perUserLimit_positive" CHECK ("perUserLimit" IS NULL OR "perUserLimit" >= 1);

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_pointsAwarded_nonneg" CHECK ("pointsAwarded" >= 0);

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_ends_after_start" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt");

-- ── Only one active academic catalogue, enforced by the database ──────────────
-- getActiveAcademicCatalogue() takes "the" active one; two would make every
-- student's programme depend on creation order. Activate a new catalogue by
-- deactivating the old one in the same transaction.
CREATE UNIQUE INDEX "AcademicCatalogue_single_active" ON "AcademicCatalogue" ((true)) WHERE "active";

-- ── Tracks the catalogue was missing (W-05) ───────────────────────────────────
-- BIG, BGL and CLEACC split into tracks that change the exam list, but the
-- database could not tell them apart. Existing profiles for these programmes
-- keep no track and are asked to pick one the next time they save.
INSERT INTO "AcademicTrack" ("id", "programmeId", "code", "name", "sourceUrl", "fromYear")
VALUES
  ('bocconi-2026-27-big-ppm', 'bocconi-2026-27-big', 'BIG-PPM', 'Politics and Policy Making', 'https://www.unibocconi.it/en/programs', 1),
  ('bocconi-2026-27-big-dso', 'bocconi-2026-27-big', 'BIG-DSO', 'Data, Society and Organisation (HEC)', 'https://www.unibocconi.it/en/programs', 1),
  ('bocconi-2026-27-bgl-gl', 'bocconi-2026-27-bgl', 'BGL-GL', 'Global Law', 'https://www.unibocconi.it/en/programs', 3),
  ('bocconi-2026-27-bgl-dl', 'bocconi-2026-27-bgl', 'BGL-DL', 'Domestic Lawyer', 'https://www.unibocconi.it/en/programs', 3),
  ('bocconi-2026-27-cleacc-ita', 'bocconi-2026-27-cleacc', 'CLEACC-ITA', 'Italian class', 'https://www.unibocconi.it/en/programs', 1),
  ('bocconi-2026-27-cleacc-eng', 'bocconi-2026-27-cleacc', 'CLEACC-ENG', 'English class', 'https://www.unibocconi.it/en/programs', 1)
ON CONFLICT ("programmeId", "code") DO NOTHING;
