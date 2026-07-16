-- ASTRA — reference: raw-SQL database objects
-- =============================================================================
-- These objects cannot be expressed in schema.prisma and are created by the
-- init migration (prisma/migrations/20260716120000_init/migration.sql). This
-- file is DOCUMENTATION of what exists in the DB — it is not applied on its own.
-- Keep it in sync if the objects change in a future migration.
-- =============================================================================

-- ── 1. DiscountUsage.usageDate — GENERATED STORED column (once-per-day guard) ──
-- Enforces "once per user, per offer, per day" via UNIQUE(userId, offerId, usageDate).
-- IMPORTANT: Postgres generated columns require an IMMUTABLE expression. `AT TIME
-- ZONE '<zone>'` is only STABLE (tz rules can change), so a Rome-local day is NOT
-- allowed here. We therefore use the UTC calendar day. If a Rome-local "day" is
-- ever required, compute it in the application/query layer instead of the column.
--
--   "usageDate" date GENERATED ALWAYS AS (("usedAt")::date) STORED
--
-- In schema.prisma this is represented as:
--   usageDate DateTime? @default(dbgenerated("(\"usedAt\")::date")) @db.Date
-- so Prisma reads it but never writes it.

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
  COUNT(*)::bigint                AS "totalAccesses",
  COUNT(DISTINCT "userId")::bigint AS "uniqueUsers",
  MAX("accessedAt")               AS "lastAccessedAt"
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
-- Not yet enabled. When implementing Phase 6, verify availability and record
-- the choice in docs/ARCHITECTURE.md:
--   CREATE EXTENSION IF NOT EXISTS postgis;   -- if available
-- Otherwise fall back to earthdistance/cube or a haversine expression in the
-- query layer (lat/lng are plain Float columns on Partner/Event).
