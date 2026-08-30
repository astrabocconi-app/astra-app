-- Call-to-action links at the bottom of a news post or an event.
--
-- Stored as JSON rather than a table: links are always read with their parent,
-- never queried across, and never joined. An array of
--   { label, kind: "external" | "internal", value }
-- validated by `contentLinks` in @astra/shared, which is where the shape is
-- enforced. "internal" values are in-app routes from a fixed allowlist, so a
-- link can send a reader to another screen instead of out to the browser.

ALTER TABLE "NewsPost" ADD COLUMN "links" JSONB;
ALTER TABLE "Event"    ADD COLUMN "links" JSONB;
