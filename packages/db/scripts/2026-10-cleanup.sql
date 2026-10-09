-- One-off production clean-up from the 2026-10 audit. NOT run automatically.
-- Idempotent: every statement only touches rows that still need it.
--
-- How to use: run the PREVIEW block, read the rows, then run the FIX block (in a
-- transaction: BEGIN; ...; COMMIT; so you can ROLLBACK if a count looks wrong).
-- Run the migration 20261005100000_backend_hardening first.

-- ============================== PREVIEW ======================================

-- B-02: ADMIN rows that are not the configured admin (replace the address).
-- SELECT id, email, "createdAt" FROM "User" WHERE 'ADMIN' = ANY(roles::text[]) AND email <> '<ADMIN_EMAIL>' AND "deletedAt" IS NULL;

-- R-01: logins still attached to deleted or hidden venues.
SELECT m.id AS membership, m."loginCode", p.name AS venue, p."deletedAt", p.active
FROM "PartnerMembership" m JOIN "Partner" p ON p.id = m."partnerId"
WHERE p."deletedAt" IS NOT NULL OR p.active = false;

-- S-04: sessions of deleted users, and expired sessions.
SELECT count(*) FILTER (WHERE u."deletedAt" IS NOT NULL) AS of_deleted_users,
       count(*) FILTER (WHERE s."expiresAt" < now()) AS expired
FROM "Session" s JOIN "User" u ON u.id = s."userId";

-- S-03: support messages of deleted users; audit rows that embed an email.
SELECT count(*) AS support_of_deleted FROM "SupportMessage" m JOIN "User" u ON u.id = m."userId" WHERE u."deletedAt" IS NOT NULL;
SELECT count(*) AS audit_with_email FROM "AuditLog" WHERE metadata::text ~ '[A-Za-z0-9._+-]+@(stud|uni)bocconi\.it';

-- ============================== FIX ==========================================

-- B-02: demote every ADMIN except the configured one and end their sessions.
-- (Signing in as the admin does this automatically from now on; this does it now.)
-- UPDATE "User" SET roles = ARRAY['STUDENT']::"Role"[] WHERE 'ADMIN' = ANY(roles::text[]) AND email <> '<ADMIN_EMAIL>';
-- DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@astra.dev');

-- R-01: revoke logins of deleted/hidden venues (sessions first, then memberships, then the users).
DELETE FROM "Session" WHERE "userId" IN (
  SELECT m."userId" FROM "PartnerMembership" m JOIN "Partner" p ON p.id = m."partnerId"
  WHERE p."deletedAt" IS NOT NULL OR p.active = false);
UPDATE "User" SET "deletedAt" = now(), email = 'revoked-' || id || '@partner.astra.local'
WHERE id IN (
  SELECT m."userId" FROM "PartnerMembership" m JOIN "Partner" p ON p.id = m."partnerId"
  WHERE p."deletedAt" IS NOT NULL) AND "deletedAt" IS NULL;
DELETE FROM "PartnerMembership" WHERE "partnerId" IN (SELECT id FROM "Partner" WHERE "deletedAt" IS NOT NULL);

-- S-04: sessions that can never be used again.
DELETE FROM "Session" WHERE "expiresAt" < now() OR "userId" IN (SELECT id FROM "User" WHERE "deletedAt" IS NOT NULL);
UPDATE "Session" SET "ipAddress" = NULL, "userAgent" = NULL
WHERE "createdAt" < now() - interval '30 days' AND ("ipAddress" IS NOT NULL OR "userAgent" IS NOT NULL);

-- S-03: free text of accounts that were already deleted.
DELETE FROM "SupportMessage" WHERE "userId" IN (SELECT id FROM "User" WHERE "deletedAt" IS NOT NULL);

-- S-03 #4: mask student addresses inside audit metadata (domain kept, local part dropped).
UPDATE "AuditLog"
SET metadata = regexp_replace(metadata::text, '[A-Za-z0-9._+-]+@((stud|uni)bocconi\.it)', 'redacted@\1', 'g')::jsonb
WHERE metadata::text ~ '[A-Za-z0-9._+-]+@(stud|uni)bocconi\.it';
