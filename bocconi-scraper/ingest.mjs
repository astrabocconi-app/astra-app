// Ingest crawled PDFs into Neon (pgvector) for the Ask-ASTRA RAG chatbot.
//
//   OPENAI_API_KEY=sk-... node ingest.mjs
//
// Reads pdfs/*.pdf + pdfs/manifest.json, extracts text, chunks (~2000 chars),
// embeds each chunk with text-embedding-3-small (1536 dims), and inserts into
// the "Document" table. Re-runnable: clears existing rows first (full refresh).
//
// DB URL: reads DIRECT_URL / DATABASE_URL from the environment or ../apps/web/.env.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import pg from "pg";
import OpenAI from "openai";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(HERE, "pdfs");

const CHUNK_CHARS = 2000;
const CHUNK_OVERLAP = 200;
const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims — matches the vector column
const EMBED_BATCH = 100;

try {
  process.loadEnvFile(path.join(HERE, "..", "apps", "web", ".env"));
} catch {
  /* rely on the ambient environment */
}
const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DB_URL) throw new Error("Set DIRECT_URL or DATABASE_URL.");
if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY.");

const openai = new OpenAI();

function chunkText(text) {
  const clean = text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  const chunks = [];
  for (let i = 0; i < clean.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
    const piece = clean.slice(i, i + CHUNK_CHARS).trim();
    if (piece.length > 50) chunks.push(piece);
  }
  return chunks;
}

async function embedBatch(texts) {
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: texts });
  return res.data.map((d) => d.embedding);
}

function toVectorLiteral(arr) {
  return `[${arr.join(",")}]`;
}

async function main() {
  const manifestPath = path.join(PDF_DIR, "manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : {};

  const files = fs.readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf"));
  if (!files.length) throw new Error(`No PDFs in ${PDF_DIR}. Run: npm run crawl`);

  // Collect (content, sourceUrl) chunks across all PDFs.
  const records = [];
  for (const file of files) {
    const sourceUrl = manifest[file] ?? file;
    const buf = fs.readFileSync(path.join(PDF_DIR, file));
    let text = "";
    try {
      text = (await pdfParse(buf)).text;
    } catch (e) {
      console.log("parse-fail:", file, String(e).slice(0, 80));
      continue;
    }
    for (const content of chunkText(text)) records.push({ content, sourceUrl });
    console.log(`parsed ${file} (${sourceUrl})`);
  }
  console.log(`\n${records.length} chunks from ${files.length} PDFs. Embedding + inserting…`);

  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  await client.query('DELETE FROM "Document"'); // full refresh

  let inserted = 0;
  for (let i = 0; i < records.length; i += EMBED_BATCH) {
    const batch = records.slice(i, i + EMBED_BATCH);
    const embeddings = await embedBatch(batch.map((r) => r.content));
    for (let j = 0; j < batch.length; j++) {
      await client.query(
        'INSERT INTO "Document" (id, content, "sourceUrl", embedding) VALUES ($1, $2, $3, $4::vector)',
        [crypto.randomUUID(), batch[j].content, batch[j].sourceUrl, toVectorLiteral(embeddings[j])],
      );
      inserted++;
    }
    console.log(`inserted ${inserted}/${records.length}`);
  }

  const { rows } = await client.query('SELECT count(*)::int AS n FROM "Document"');
  console.log(`\nDone. Document rows: ${rows[0].n}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
