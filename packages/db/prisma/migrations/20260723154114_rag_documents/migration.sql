-- Enable pgvector (Neon supports it). Must precede the vector column.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- IVFFlat index for fast cosine-distance (<=>) similarity search.
-- lists=100 suits up to ~100k rows; rebuild with more lists if the corpus grows.
CREATE INDEX "Document_embedding_ivfflat_idx"
    ON "Document"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);
