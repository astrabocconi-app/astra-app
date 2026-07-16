-- ASTRA — raw-SQL migration companion
-- =============================================================================
-- Database objects Prisma cannot express in schema.prisma. Fold this into a
-- Prisma migration (do NOT rely on it applying by itself):
--
--   1. Create the base schema migration WITHOUT applying:
--        npm run migrate -w @astra/db -- --create-only --name init
--   2. Append the SQL below to that migration's migration.sql
--      (or create a follow-up:  -- --create-only --name views_and_immutability).
--   3. Apply:  npm run migrate -w @astra/db
--
-- NOTE (must verify against the live DB during the migrate run):
--   * Postgres GENERATED columns cannot be written by Prisma. usageDate is
--     modelled in schema.prisma for the unique constraint, but the migration
--     must (re)create it as GENERATED so the app never inserts it. If Prisma's
--     drift check complains, represent it with @default(dbgenerated(...)) or
--     drop the field from the model and keep the unique index here in SQL.
--   * Constraint/index names below assume Prisma's defaults — confirm the exact
--     names in the generated migration before running.
-- =============================================================================

-- ── 1. DiscountUsage.usageDate → GENERATED (once-per-user-per-offer-per-day) ──
-- Rome-local calendar day so "per day" matches the user's timezone.
ALTER TABLE "DiscountUsage"
  DROP CONSTRAINT IF EXISTS "DiscountUsage_userId_offerId_usageDate_key";
ALTER TABLE "DiscountUsage" DROP COLUMN IF EXISTS "usageDate";
ALTER TABLE "DiscountUsage"
  ADD COLUMN "usageDate" date
  GENERATED ALWAYS AS ((("usedAt" AT TIME ZONE 'Europe/Rome'))::date) STORED;
ALTER TABLE "DiscountUsage"
  ADD CONSTRAINT "DiscountUsage_userId_offerId_usageDate_key"
  UNIQUE ("userId", "offerId", "usageDate");

-- ── 2. PointsBalance — spendable balance per (user, kind). No mutable column. ──
CREATE OR REPLACE VIEW "PointsBalance" AS
SELECT
  "userId",
  "kind",
  COALESCE(SUM("delta"), 0)::bigint AS "balance"
FROM "PointsLedgerEntry"
GROUP BY "userId", "kind";

-- ── 3. MaterialStats — AGGREGATE ONLY. Never exposes per-user access rows. ──
CREATE OR REPLACE VIEW "MaterialStats" AS
SELECT
  "materialId",
  COUNT(*)::bigint                     AS "totalAccesses",
  COUNT(DISTINCT "userId")::bigint      AS "uniqueUsers",
  MAX("accessedAt")                     AS "lastAccessedAt"
FROM "MaterialAccess"
GROUP BY "materialId";

-- ── 4. Ledger immutability — block UPDATE and DELETE at the DB level. ──
-- The append-only guarantee must not depend on application discipline.
-- (Because of this, never hard-DELETE a User whose ledger rows cascade — use
--  soft delete via deletedAt. A cascade delete would hit this trigger.)
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

-- ── 5. Geo (partners "near me") — PostGIS is optional on Neon. ──
-- Verify availability, then record the choice in docs/ARCHITECTURE.md:
--   CREATE EXTENSION IF NOT EXISTS postgis;   -- if available
-- If unavailable, fall back to earthdistance/cube or a haversine expression in
-- the query layer (lat/lng are plain Float columns on Partner/Event).
