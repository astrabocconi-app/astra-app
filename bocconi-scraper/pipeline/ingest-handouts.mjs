// Ingest OCR'd handouts into Neon for Ask-ASTRA RAG.
//
// Reads corpus/handouts_txt/h<id>.txt (produced by ocr-handouts.py) + the
// manifest, chunks with provenance metadata (year/subject/filename), embeds, and
// inserts with sourceType "handout" and sourceUrl = the Supabase file_url (so
// citations open the real handout). Run AFTER ocr-handouts.py.
//
//   OPENAI_API_KEY (apps/web/.env) node pipeline/ingest-handouts.mjs
//
// Re-runnable: refreshes only sourceType "handout".

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chunkPages, connectDb, clearSourceType, embedAndInsert } from "./rag-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CORPUS = path.join(ROOT, "corpus");
const TXT_DIR = path.join(CORPUS, "handouts_txt");
try {
  process.loadEnvFile(path.join(ROOT, "..", "apps", "web", ".env"));
} catch {
  /* ambient env */
}
if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY (apps/web/.env).");

const manifest = JSON.parse(fs.readFileSync(path.join(CORPUS, "handouts_manifest.json"), "utf8"));

// RESUME=1 skips handouts already ingested (by file_url) and does NOT clear —
// used to finish a run interrupted by the Neon size limit without re-embedding.
const RESUME = process.env.RESUME === "1";
const client = await connectDb();
let present = new Set();
if (RESUME) {
  const { rows } = await client.query(
    `SELECT DISTINCT "sourceUrl" FROM "Document" WHERE "sourceType" = 'handout' AND "subject" IS DISTINCT FROM 'CLMG'`,
  );
  present = new Set(rows.map((r) => r.sourceUrl));
  console.log(`RESUME: ${present.size} handout files already present — skipping them.`);
}

const records = [];
let used = 0;
let empty = 0;
for (const e of manifest) {
  if (RESUME && present.has(e.file_url)) continue;
  const txtPath = path.join(TXT_DIR, e.local.replace(".pdf", ".txt"));
  if (!fs.existsSync(txtPath)) continue;
  const raw = fs.readFileSync(txtPath, "utf8");
  if (raw.replace(/\s/g, "").length < 80) {
    empty++;
    continue; // OCR produced essentially nothing (e.g. pure handwriting/images)
  }
  const pages = raw.split("\f");
  const chunks = chunkPages(pages, { target: 1100, overlap: 120 });
  if (!chunks.length) {
    empty++;
    continue;
  }
  used++;
  const subject = (e.subject || "").trim();
  const year = e.year_norm || e.year || "";
  const title = subject ? `${e.filename} (${subject}, ${year})` : e.filename;
  for (const c of chunks) {
    records.push({
      content: c.content,
      title,
      sourceType: "handout",
      sourceUrl: e.file_url,
      year,
      subject,
      page: c.page,
      chunkIndex: c.chunkIndex,
    });
  }
}

console.log(`Handouts with usable OCR text: ${used} (${empty} skipped as empty). ${records.length} chunks. Embedding…`);

// Full refresh (unless resuming): replace scanned handouts only. CLMG dispense
// also use sourceType 'handout' (subject 'CLMG') and must not be clobbered.
if (!RESUME) {
  await client.query(`DELETE FROM "Document" WHERE "sourceType" = 'handout' AND "subject" IS DISTINCT FROM 'CLMG'`);
}
const n = await embedAndInsert(client, records, (done, total) => {
  if (done % 300 === 0 || done === total) console.log(`  embedded ${done}/${total}`);
});
const { rows } = await client.query('SELECT count(*)::int AS n FROM "Document"');
console.log(`\nDone. Inserted ${n} handout chunks. Document total: ${rows[0].n}.`);
await client.end();
