-- RAG overhaul: add citation/provenance metadata to Document, plus indexes for
-- hybrid (vector + keyword) retrieval.

ALTER TABLE "Document"
    ADD COLUMN "title" TEXT,
    ADD COLUMN "sourceType" TEXT,
    ADD COLUMN "year" TEXT,
    ADD COLUMN "subject" TEXT,
    ADD COLUMN "page" INTEGER,
    ADD COLUMN "chunkIndex" INTEGER;

CREATE INDEX "Document_sourceType_idx" ON "Document"("sourceType");
CREATE INDEX "Document_year_subject_idx" ON "Document"("year", "subject");

-- HNSW index for cosine similarity. Correct at all corpus sizes (unlike the
-- IVFFlat index dropped earlier), and now warranted as the corpus grows to
-- thousands of chunks after ingesting guides + OCR'd handouts.
CREATE INDEX "Document_embedding_hnsw_idx" ON "Document"
    USING hnsw ("embedding" vector_cosine_ops);

-- Hybrid search: GIN expression index for full-text keyword matching over
-- content. 'simple' config is language-agnostic (corpus is mixed Italian/English).
CREATE INDEX "Document_content_fts_idx" ON "Document"
    USING gin (to_tsvector('simple', "content"));
