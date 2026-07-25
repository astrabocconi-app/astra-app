-- Drop the HNSW vector index. On Neon's free tier (512 MB project limit) the
-- ~194 MB HNSW index over ~28k embedded chunks pushed the DB over the cap. At
-- this corpus size an exact sequential scan for cosine distance (<=>) runs in
-- tens of milliseconds, which is fine for Ask-ASTRA's low query volume. If the
-- corpus grows large or latency matters, restore an index — ideally over a
-- halfvec cast to halve its size:
--   CREATE INDEX "Document_embedding_hnsw_idx" ON "Document"
--     USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops);
DROP INDEX IF EXISTS "Document_embedding_hnsw_idx";
