-- The Ask-ASTRA RAG corpus (Document + embeddings) has been migrated to Supabase
-- Postgres (separate DB, queried via pg — see apps/web/lib/rag-db.ts). Drop it
-- here to reclaim the ~360 MB it held on Neon's free tier. Data lives on Supabase.
DROP TABLE IF EXISTS "Document";
