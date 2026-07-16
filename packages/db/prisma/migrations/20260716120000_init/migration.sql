-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'STAFF', 'AREA_MANAGER', 'ADMIN', 'PARTNER_MANAGER');

-- CreateEnum
CREATE TYPE "PointsKind" AS ENUM ('POINTS');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('SIGNUP', 'EVENT_CHECKIN', 'PARTNER_SCAN', 'REWARD_REDEMPTION', 'ADMIN_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED', 'FREEBIE', 'OTHER');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'WAITLIST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'USED', 'VOID');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "roles" "Role"[] DEFAULT ARRAY['STUDENT']::"Role"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PointsKind" NOT NULL DEFAULT 'POINTS',
    "delta" INTEGER NOT NULL,
    "source" "LedgerSource" NOT NULL DEFAULT 'OTHER',
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "logoKey" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "areaId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL DEFAULT 'OTHER',
    "discountValue" INTEGER,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usageDate" DATE GENERATED ALWAYS AS (("usedAt")::date) STORED,

    CONSTRAINT "DiscountUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageKey" TEXT,
    "costPoints" INTEGER NOT NULL,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "areaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "costPoints" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageKey" TEXT,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "pointsOnCheckin" INTEGER NOT NULL DEFAULT 0,
    "areaId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "excerpt" TEXT,
    "coverImageKey" TEXT,
    "authorId" TEXT,
    "areaId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileType" TEXT,
    "sizeBytes" INTEGER,
    "areaId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAccess" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "userId" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "areaId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Area_slug_key" ON "Area"("slug");

-- CreateIndex
CREATE INDEX "AreaMembership_areaId_idx" ON "AreaMembership"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaMembership_userId_areaId_key" ON "AreaMembership"("userId", "areaId");

-- CreateIndex
CREATE INDEX "Consent_userId_idx" ON "Consent"("userId");

-- CreateIndex
CREATE INDEX "PointsLedgerEntry_userId_kind_idx" ON "PointsLedgerEntry"("userId", "kind");

-- CreateIndex
CREATE INDEX "PointsLedgerEntry_refType_refId_idx" ON "PointsLedgerEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "PointsLedgerEntry_createdAt_idx" ON "PointsLedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "Partner_active_deletedAt_idx" ON "Partner"("active", "deletedAt");

-- CreateIndex
CREATE INDEX "Offer_partnerId_active_idx" ON "Offer"("partnerId", "active");

-- CreateIndex
CREATE INDEX "DiscountUsage_offerId_idx" ON "DiscountUsage"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountUsage_userId_offerId_usageDate_key" ON "DiscountUsage"("userId", "offerId", "usageDate");

-- CreateIndex
CREATE INDEX "Reward_active_deletedAt_idx" ON "Reward"("active", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_code_key" ON "RewardRedemption"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_ledgerEntryId_key" ON "RewardRedemption"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "RewardRedemption_userId_idx" ON "RewardRedemption"("userId");

-- CreateIndex
CREATE INDEX "RewardRedemption_rewardId_status_idx" ON "RewardRedemption"("rewardId", "status");

-- CreateIndex
CREATE INDEX "Event_published_startsAt_idx" ON "Event"("published", "startsAt");

-- CreateIndex
CREATE INDEX "Rsvp_userId_idx" ON "Rsvp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_eventId_userId_key" ON "Rsvp"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_eventId_userId_key" ON "Ticket"("eventId", "userId");

-- CreateIndex
CREATE INDEX "NewsPost_published_pinned_publishedAt_idx" ON "NewsPost"("published", "pinned", "publishedAt");

-- CreateIndex
CREATE INDEX "Material_published_deletedAt_idx" ON "Material"("published", "deletedAt");

-- CreateIndex
CREATE INDEX "MaterialAccess_materialId_idx" ON "MaterialAccess"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AreaMembership" ADD CONSTRAINT "AreaMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaMembership" ADD CONSTRAINT "AreaMembership_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedgerEntry" ADD CONSTRAINT "PointsLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedgerEntry" ADD CONSTRAINT "PointsLedgerEntry_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAccess" ADD CONSTRAINT "MaterialAccess_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAccess" ADD CONSTRAINT "MaterialAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- Raw-SQL objects Prisma can't express (see prisma/sql/0001_views_and_immutability.sql)
-- =============================================================================

-- PointsBalance — spendable balance per (user, kind). No mutable column.
CREATE OR REPLACE VIEW "PointsBalance" AS
SELECT "userId", "kind", COALESCE(SUM("delta"), 0)::bigint AS "balance"
FROM "PointsLedgerEntry"
GROUP BY "userId", "kind";

-- MaterialStats — AGGREGATE ONLY. Never exposes per-user access rows.
CREATE OR REPLACE VIEW "MaterialStats" AS
SELECT "materialId",
       COUNT(*)::bigint                AS "totalAccesses",
       COUNT(DISTINCT "userId")::bigint AS "uniqueUsers",
       MAX("accessedAt")               AS "lastAccessedAt"
FROM "MaterialAccess"
GROUP BY "materialId";

-- Ledger immutability — block UPDATE and DELETE at the DB level.
CREATE OR REPLACE FUNCTION astra_block_ledger_mutation()
  RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PointsLedgerEntry is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_no_update_delete ON "PointsLedgerEntry";
CREATE TRIGGER ledger_no_update_delete
  BEFORE UPDATE OR DELETE ON "PointsLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION astra_block_ledger_mutation();
