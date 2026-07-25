// Shared RAG ingestion helpers: PDF text extraction (page-aware), section-aware
// chunking, embeddings, and Neon inserts with citation metadata.
//
// Embeddings: text-embedding-3-large truncated to 1536 dims (Matryoshka) — better
// quality than 3-small while keeping the vector(1536) column (HNSW-indexable).

import { execFileSync } from "node:child_process";
import pg from "pg";
import OpenAI from "openai";

export const EMBED_MODEL = "text-embedding-3-large";
export const EMBED_DIMS = 1536; // matches Document.embedding vector(1536)
const EMBED_BATCH = 96;

let _openai = null;
function openai() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

/** Extract text per page via poppler's pdftotext. Returns string[] (one per page). */
export function extractPages(pdfPath) {
  let raw;
  try {
    raw = execFileSync("pdftotext", ["-q", "-enc", "UTF-8", pdfPath, "-"], {
      maxBuffer: 256 * 1024 * 1024,
    }).toString("utf8");
  } catch {
    return [];
  }
  // pdftotext separates pages with a form-feed (\f).
  return raw.split("\f");
}

function cleanup(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trimEnd())
    // Drop lines that are just a page number or a lone bullet/artifact.
    .filter((l) => !/^\s*\d{1,4}\s*$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Section-aware chunking. Concatenates pages (tracking page offsets so each chunk
 * gets its starting page), then slides a ~targetChars window that snaps to the
 * next paragraph/sentence boundary. Returns [{ content, page, chunkIndex }].
 */
export function chunkPages(pages, { target = 1200, overlap = 150, minChars = 60 } = {}) {
  let text = "";
  const offsets = [];
  pages.forEach((p, i) => {
    const c = cleanup(p);
    if (!c) return;
    offsets.push({ start: text.length, page: i + 1 });
    text += c + "\n\n";
  });
  const pageAt = (pos) => {
    let pg = 1;
    for (const o of offsets) {
      if (o.start <= pos) pg = o.page;
      else break;
    }
    return pg;
  };

  const chunks = [];
  let i = 0;
  let idx = 0;
  while (i < text.length) {
    let end = Math.min(i + target, text.length);
    if (end < text.length) {
      const slack = text.slice(end, Math.min(end + 240, text.length));
      const brk = slack.search(/\n\n|(?<=[.!?])\s|\n/);
      if (brk >= 0) end += brk + 1;
    }
    const piece = text.slice(i, end).trim();
    if (piece.length >= minChars) chunks.push({ content: piece, page: pageAt(i), chunkIndex: idx++ });
    if (end >= text.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks;
}

export async function embedBatch(texts) {
  const res = await openai().embeddings.create({
    model: EMBED_MODEL,
    input: texts,
    dimensions: EMBED_DIMS,
  });
  return res.data.map((d) => d.embedding);
}

export function toVectorLiteral(arr) {
  return `[${arr.join(",")}]`;
}

export async function connectDb() {
  // RAG corpus now lives on Supabase (RAG_DIRECT_URL = session pooler). Fall back
  // to Neon only if the split isn't configured.
  const url = process.env.RAG_DIRECT_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set RAG_DIRECT_URL (Supabase) or DIRECT_URL.");
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

/** Per-sourceType refresh so text- and handout-ingest don't clobber each other. */
export async function clearSourceType(client, sourceType) {
  await client.query('DELETE FROM "Document" WHERE "sourceType" = $1', [sourceType]);
}

/**
 * Embed + insert records. Each record: { content, title, sourceType, sourceUrl,
 * year?, subject?, page?, chunkIndex? }. Returns count inserted.
 */
export async function embedAndInsert(client, records, onProgress) {
  let inserted = 0;
  for (let i = 0; i < records.length; i += EMBED_BATCH) {
    const batch = records.slice(i, i + EMBED_BATCH);
    const embeddings = await embedBatch(batch.map((r) => r.content));
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      await client.query(
        `INSERT INTO "Document"
           (id, content, title, "sourceType", "sourceUrl", year, subject, page, "chunkIndex", embedding)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
        [
          r.content,
          r.title ?? null,
          r.sourceType ?? null,
          r.sourceUrl,
          r.year ?? null,
          r.subject ?? null,
          r.page ?? null,
          r.chunkIndex ?? null,
          toVectorLiteral(embeddings[j]),
        ],
      );
      inserted++;
    }
    if (onProgress) onProgress(inserted, records.length);
  }
  return inserted;
}
