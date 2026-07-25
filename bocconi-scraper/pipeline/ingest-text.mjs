// Ingest the TEXT-based corpus into Neon for Ask-ASTRA RAG:
//   - guides (corpus/guides/guide/<category>/*.pdf)
//   - bintouch FAQ.pdf, ASTRA description.pdf (~/Downloads)
//
//   OPENAI_API_KEY (from apps/web/.env) node pipeline/ingest-text.mjs
//
// Re-runnable: refreshes only sourceType in {guide, faq, about} — leaves handouts.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { extractPages, chunkPages, connectDb, clearSourceType, embedAndInsert } from "./rag-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
try {
  process.loadEnvFile(path.join(ROOT, "..", "apps", "web", ".env"));
} catch {
  /* ambient env */
}
if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY (apps/web/.env).");

// NOTE: guides are now ingested from the Supabase `guides` table (with real,
// openable file_urls) by ingest-supabase.mjs — NOT from the local guide.zip.
// This script handles only the standalone PDFs below.

// Build the list of (file, meta) sources.
const sources = [];

// Standalone PDFs from ~/Downloads.
const dl = path.join(os.homedir(), "Downloads");
const extras = [
  { file: path.join(dl, "bintouch FAQ.pdf"), title: "Bintouch FAQ", sourceType: "faq", sourceUrl: "https://www.astrabocconi.com" },
  { file: path.join(dl, "ASTRA description.pdf"), title: "About ASTRA", sourceType: "about", sourceUrl: "https://www.astrabocconi.com/chi-siamo" },
];
for (const e of extras) if (fs.existsSync(e.file)) sources.push(e);

console.log(`Sources: ${sources.length} standalone PDFs (FAQ, description).`);

// Extract + chunk.
const records = [];
let skipped = 0;
for (const s of sources) {
  const pages = extractPages(s.file);
  const chunks = chunkPages(pages);
  if (!chunks.length) {
    skipped++;
    console.log(`  ⚠ no text: ${path.basename(s.file)}`);
    continue;
  }
  for (const c of chunks) {
    records.push({
      content: c.content,
      title: s.title,
      sourceType: s.sourceType,
      sourceUrl: s.sourceUrl,
      page: c.page,
      chunkIndex: c.chunkIndex,
    });
  }
  console.log(`  ✓ ${chunks.length} chunks  ${s.title}`);
}
console.log(`\n${records.length} chunks total (${skipped} PDFs had no extractable text). Embedding…`);

const client = await connectDb();
for (const t of ["faq", "about"]) await clearSourceType(client, t);
const n = await embedAndInsert(client, records, (done, total) => {
  if (done % 200 === 0 || done === total) console.log(`  embedded ${done}/${total}`);
});
const { rows } = await client.query('SELECT count(*)::int AS n FROM "Document"');
console.log(`\nDone. Inserted ${n} text chunks. Document total: ${rows[0].n}.`);
await client.end();
