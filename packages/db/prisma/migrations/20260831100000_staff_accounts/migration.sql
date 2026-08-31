-- Backoffice staff accounts with per-page access.
--
-- Kept on User rather than a parallel table so sessions, audit logs and account
-- deletion keep working unchanged, and so an account cannot exist in one system
-- but not the other.
--
-- Staff sign in with a username and password because they are given an account
-- by an admin; the email-OTP path is for students, who create their own and
-- must hold a Bocconi address.
--
-- dashboardPages is a plain string array rather than a join table: it is always
-- read whole with the user, never queried across, and the set of pages is fixed
-- by the code that renders them.

ALTER TABLE "User" ADD COLUMN "staffUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "staffPasswordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "dashboardPages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "User_staffUsername_key" ON "User"("staffUsername");
