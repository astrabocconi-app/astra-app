// Split the RAG vector store off Neon onto Supabase Postgres.
//
// Creates the Document table + pgvector on Supabase, copies every chunk (text +
// embedding) from Neon, then builds the FTS + halfvec indexes. Idempotent: drops
// and recreates the Supabase Document table each run.
//
//   node pipeline/migrate-to-supabase.mjs
//
// Source: DIRECT_URL (Neon). Dest: RAG_DIRECT_URL (Supabase session pooler).

import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.join(HERE, "..", "..", "apps", "web", ".env"));

const SRC = process.env.DIRECT_URL; // Neon
const DST = process.env.RAG_DIRECT_URL; // Supabase session pooler
if (!SRC || !DST) throw new Error("Need DIRECT_URL (Neon) and RAG_DIRECT_URL (Supabase).");

const src = new pg.Client({ connectionString: SRC });
const dst = new pg.Client({ connectionString: DST, ssl: { rejectUnauthorized: false } });
await src.connect();
await dst.connect();

console.log("Preparing Supabase schema…");
await dst.query(`CREATE EXTENSION IF NOT EXISTS vector`);
await dst.query(`DROP TABLE IF EXISTS "Document"`);
await dst.query(`
  CREATE TABLE "Document" (
    "id" text PRIMARY KEY,
    "content" text NOT NULL,
    "title" text,
    "sourceType" text,
    "sourceUrl" text NOT NULL,
    "year" text,
    "subject" text,
    "page" integer,
    "chunkIndex" integer,
    "embedding" vector(1536),
    "createdAt" timestamptz NOT NULL DEFAULT now()
  )
`);

const { rows: countRows } = await src.query(`SELECT count(*)::int n FROM "Document"`);
const total = countRows[0].n;
console.log(`Copying ${total} rows Neon → Supabase…`);

const BATCH = 400;
let copied = 0;
for (let offset = 0; offset < total; offset += BATCH) {
  const { rows } = await src.query(
    `SELECT id, content, title, "sourceType", "sourceUrl", year, subject, page, "chunkIndex",
            embedding::text AS emb
     FROM "Document" ORDER BY id LIMIT $1 OFFSET $2`,
    [BATCH, offset],
  );
  if (!rows.length) break;

  const cols = 10;
  const values = [];
  const params = [];
  rows.forEach((r, i) => {
    const b = i * cols;
    values.push(
      `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10}::vector)`,
    );
    params.push(r.id, r.content, r.title, r.sourceType, r.sourceUrl, r.year, r.subject, r.page, r.chunkIndex, r.emb);
  });
  await dst.query(
    `INSERT INTO "Document"
       (id, content, title, "sourceType", "sourceUrl", year, subject, page, "chunkIndex", embedding)
     VALUES ${values.join(",")} ON CONFLICT (id) DO NOTHING`,
    params,
  );
  copied += rows.length;
  if (offset % (BATCH * 10) === 0 || copied === total) console.log(`  copied ${copied}/${total}`);
}

console.log("Building indexes on Supabase…");
await dst.query(`CREATE INDEX "Document_sourceType_idx" ON "Document"("sourceType")`);
await dst.query(`CREATE INDEX "Document_year_subject_idx" ON "Document"("year","subject")`);
await dst.query(
  `CREATE INDEX "Document_content_fts_idx" ON "Document" USING gin (to_tsvector('simple', content))`,
);
await dst.query(
  `CREATE INDEX "Document_embedding_hnsw_idx" ON "Document" USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops)`,
);

const { rows: dstCount } = await dst.query(`SELECT count(*)::int n FROM "Document"`);
console.log(`\nDone. Supabase Document rows: ${dstCount[0].n} (source ${total}).`);
await src.end();
await dst.end();
