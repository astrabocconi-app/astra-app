-- Attribute a partner scan to the specific offer it was for, so a venue running
-- several promotions can see which one is actually being used.
--
-- ON DELETE RESTRICT is deliberate. PointsLedgerEntry is append-only, enforced
-- by the ledger_no_update_delete trigger, so SET NULL (Prisma's default for an
-- optional relation) or CASCADE would fire a blocked UPDATE/DELETE and make
-- removing an offer fail with a confusing error. Offers are only ever
-- soft-deleted, so RESTRICT never bites in practice — it just guarantees
-- history can't be rewritten.

ALTER TABLE "PointsLedgerEntry" ADD COLUMN "offerId" TEXT;

CREATE INDEX "PointsLedgerEntry_offerId_idx" ON "PointsLedgerEntry"("offerId");

ALTER TABLE "PointsLedgerEntry"
  ADD CONSTRAINT "PointsLedgerEntry_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
