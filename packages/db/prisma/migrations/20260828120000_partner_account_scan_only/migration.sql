-- Partner logins: scan-only mode + a human label.
--
-- Venues asked for accounts that can award points but can't see takings, so
-- floor staff don't have access to the numbers. Additive and defaulted, so
-- every existing login keeps full access.

ALTER TABLE "PartnerMembership"
  ADD COLUMN "scanOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "label" TEXT;
