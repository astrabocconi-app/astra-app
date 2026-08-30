-- Record of push notifications sent from the backoffice.
--
-- Sending is otherwise fire-and-forget: once a notification leaves for Expo
-- there is no way to answer "what did we send, to whom, and when". This is also
-- what stops the same announcement going out twice because whoever pressed the
-- button was not sure it worked.
--
-- sentById is SET NULL rather than CASCADE: if the admin who sent it later
-- leaves, the record of the send should survive them.

CREATE TABLE "PushCampaign" (
  "id"        TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "route"     TEXT,
  "filters"   JSONB NOT NULL,
  "sentCount" INTEGER NOT NULL,
  "userCount" INTEGER NOT NULL,
  "sentById"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushCampaign_createdAt_idx" ON "PushCampaign"("createdAt");

ALTER TABLE "PushCampaign"
  ADD CONSTRAINT "PushCampaign_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
