-- In-app support: questions, issues and ideas sent from the app.
--
-- Always attached to the account that sent it, so the backoffice has an address
-- to reply to without asking people to retype (and mistype) their email.
--
-- ON DELETE RESTRICT rather than CASCADE: a thread may be mid-conversation when
-- someone deletes their account, and deletion anonymises the User row anyway
-- (see apps/web/lib/account.ts), so the message survives without carrying
-- personal data.

CREATE TYPE "SupportKind" AS ENUM ('QUESTION', 'ISSUE', 'IDEA');
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "SupportMessage" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "kind"       "SupportKind" NOT NULL DEFAULT 'QUESTION',
  "message"    TEXT NOT NULL,
  "status"     "SupportStatus" NOT NULL DEFAULT 'OPEN',
  "adminNote"  TEXT,
  "appVersion" TEXT,
  "platform"   TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- The inbox is read newest-first, filtered by status.
CREATE INDEX "SupportMessage_status_createdAt_idx" ON "SupportMessage"("status", "createdAt");
CREATE INDEX "SupportMessage_userId_idx" ON "SupportMessage"("userId");

ALTER TABLE "SupportMessage"
  ADD CONSTRAINT "SupportMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
