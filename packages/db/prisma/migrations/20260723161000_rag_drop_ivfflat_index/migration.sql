-- Drop the IVFFlat index. On a small corpus, an IVFFlat query probes a single
-- (near-empty) list and returns no rows — breaking retrieval. A sequential scan
-- is exact and fast at this scale. When the corpus grows to thousands of rows,
-- add an HNSW index instead (correct at all sizes, unlike IVFFlat on small data):
--   CREATE INDEX "Document_embedding_hnsw_idx" ON "Document"
--     USING hnsw ("embedding" vector_cosine_ops);
DROP INDEX IF EXISTS "Document_embedding_ivfflat_idx";
