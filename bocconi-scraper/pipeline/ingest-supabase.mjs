// Ingest Supabase-hosted docs into Neon for Ask-ASTRA RAG:
//   - `guides` table    → sourceType "guide", sourceUrl = the real hosted file_url
//   - `clmg_handouts`   → sourceType "handout", subject "CLMG" (Giurisprudenza)
//
// This SUPERSEDES the local guide ingestion (ingest-text.mjs guides) because the
// table gives authoritative, openable links. Text-based PDFs → pdftotext; short
// extractions fall back to OCR (tesseract eng+ita).
//
//   node pipeline/ingest-supabase.mjs
//
// Re-runnable: refreshes sourceType "guide" and the CLMG handouts only.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractPages, chunkPages, connectDb, embedAndInsert } from "./rag-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CACHE = path.join(ROOT, "corpus", "sb_cache");
fs.mkdirSync(CACHE, { recursive: true });
try {
  process.loadEnvFile(path.join(ROOT, "..", "apps", "web", ".env"));
} catch {
  /* ambient env */
}
if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY.");
const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !KEY) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY.");

function fetchTable(table, query) {
  const out = execFileSync("curl", [
    "-s",
    "-H", `apikey: ${KEY}`,
    "-H", `Authorization: Bearer ${KEY}`,
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
  ], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
  return JSON.parse(out);
}

function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  try {
    execFileSync("curl", ["-s", "-f", "-L", url, "-o", dest], { maxBuffer: 8 * 1024 });
    return fs.existsSync(dest) && fs.statSync(dest).size > 0;
  } catch {
    return false;
  }
}

// Extract text; OCR fallback for short (scanned) extractions.
function extractText(pdfPath) {
  const pages = extractPages(pdfPath);
  const chars = pages.join("").replace(/\s/g, "").length;
  if (chars >= 200) return pages;
  // OCR fallback (bounded) via pdftoppm + tesseract.
  try {
    const tmp = fs.mkdtempSync(path.join(CACHE, "ocr-"));
    execFileSync("pdftoppm", ["-r", "150", "-l", "60", "-png", pdfPath, path.join(tmp, "p")], {
      stdio: "ignore",
    });
    const imgs = fs.readdirSync(tmp).filter((f) => f.endsWith(".png")).sort();
    const ocr = imgs.map((im) =>
      execFileSync("tesseract", [path.join(tmp, im), "stdout", "-l", "eng+ita", "--psm", "6"], {
        maxBuffer: 32 * 1024 * 1024,
      }).toString("utf8"),
    );
    fs.rmSync(tmp, { recursive: true, force: true });
    return ocr;
  } catch {
    return pages;
  }
}

function buildRecords(entries) {
  const records = [];
  let ok = 0;
  let empty = 0;
  for (const e of entries) {
    if (!download(e.url, e.dest)) {
      console.log(`  ✗ download failed: ${e.title}`);
      continue;
    }
    const pages = extractText(e.dest);
    const chunks = chunkPages(pages, { target: 1200, overlap: 150 });
    if (!chunks.length) {
      empty++;
      continue;
    }
    ok++;
    for (const c of chunks) {
      records.push({
        content: c.content,
        title: e.title,
        sourceType: e.sourceType,
        sourceUrl: e.url,
        year: e.year ?? null,
        subject: e.subject ?? null,
        page: c.page,
        chunkIndex: c.chunkIndex,
      });
    }
    console.log(`  ✓ ${chunks.length} chunks  ${e.title}`);
  }
  return { records, ok, empty };
}

const yearFromNum = (v) => {
  const n = String(v ?? "").trim();
  return n.startsWith("1") ? "First Year"
    : n.startsWith("2") ? "Second Year"
    : n.startsWith("3") ? "Third Year"
    : n.startsWith("4") ? "Fourth Year"
    : n.startsWith("5") ? "Fifth Year"
    : null;
};

// ---- Guides ----
const guides = fetchTable("guides", "select=id,title,category,file_url,is_active");
const guideEntries = guides
  .filter((g) => g.is_active !== false && (g.file_url ?? "").startsWith("http"))
  .map((g) => ({
    url: g.file_url,
    dest: path.join(CACHE, `guide_${g.id}.pdf`),
    title: g.category ? `${g.title} (${g.category})` : g.title,
    sourceType: "guide",
  }));

// ---- CLMG handouts ----
const clmg = fetchTable("clmg_handouts", "select=id,name,course_year,url,semester,exam_type");
const clmgEntries = clmg
  .filter((c) => (c.url ?? "").startsWith("http"))
  .map((c) => ({
    url: c.url,
    dest: path.join(CACHE, `clmg_${c.id}.pdf`),
    title: `${c.name} (CLMG${c.course_year ? `, Year ${c.course_year}` : ""})`,
    sourceType: "handout",
    subject: "CLMG",
    year: yearFromNum(c.course_year),
  }));

console.log(`Guides: ${guideEntries.length}, CLMG handouts: ${clmgEntries.length}. Downloading + extracting…`);

console.log("\n== Guides ==");
const g = buildRecords(guideEntries);
console.log("\n== CLMG ==");
const c = buildRecords(clmgEntries);

const client = await connectDb();
// Refresh: replace all guides, and the CLMG handouts only.
await client.query(`DELETE FROM "Document" WHERE "sourceType" = 'guide'`);
await client.query(`DELETE FROM "Document" WHERE "sourceType" = 'handout' AND "subject" = 'CLMG'`);

console.log(`\nEmbedding ${g.records.length} guide + ${c.records.length} CLMG chunks…`);
const nG = await embedAndInsert(client, g.records, (d, t) => d % 300 === 0 && console.log(`  guides ${d}/${t}`));
const nC = await embedAndInsert(client, c.records, (d, t) => d % 300 === 0 && console.log(`  clmg ${d}/${t}`));

const { rows } = await client.query(
  `SELECT "sourceType", count(*)::int n FROM "Document" GROUP BY 1 ORDER BY 2 DESC`,
);
console.log(`\nDone. Guides ${nG} (${g.ok} files), CLMG ${nC} (${c.ok} files).`);
console.log("By sourceType:", rows);
await client.end();
