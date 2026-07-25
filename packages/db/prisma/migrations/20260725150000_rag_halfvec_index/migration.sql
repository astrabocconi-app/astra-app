-- Restore a fast vector index using halfvec (float16), which is ~half the size
-- of a full-precision HNSW index — small enough to fit Neon's 512 MB free tier
-- while keeping cosine search at index speed. Retrieval casts the query to
-- halfvec to match (see lib/rag.ts); display similarity stays full precision.
CREATE INDEX "Document_embedding_hnsw_idx" ON "Document"
    USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops);
