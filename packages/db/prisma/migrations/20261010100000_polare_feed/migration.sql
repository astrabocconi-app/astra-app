-- Stella Polare feed: posts entered by hand in the backoffice.
CREATE TABLE "PolarePost" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "caption" TEXT NOT NULL DEFAULT '',
  "media" JSONB NOT NULL,
  "externalUrl" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "authorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PolarePost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PolarePost_published_deletedAt_publishedAt_idx" ON "PolarePost"("published", "deletedAt", "publishedAt");
