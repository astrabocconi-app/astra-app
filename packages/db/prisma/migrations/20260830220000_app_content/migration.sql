-- Editable app content, so a page can be corrected without an App Store update.
--
-- One row per screen, keyed by name. The payload is JSON in that screen's own
-- shape rather than a generic block model: this exists to make one specific
-- page editable, not to become a CMS. The app ships with a bundled copy and
-- falls back to it, so a missing or malformed row degrades to what was
-- compiled in rather than to an empty screen.

CREATE TABLE "AppContent" (
  "key"         TEXT NOT NULL,
  "data"        JSONB NOT NULL,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "updatedById" TEXT,
  CONSTRAINT "AppContent_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "AppContent"
  ADD CONSTRAINT "AppContent_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
