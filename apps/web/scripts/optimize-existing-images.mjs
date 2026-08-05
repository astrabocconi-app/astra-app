// One-off backfill: re-encode ImageAsset rows that predate upload-time
// optimization (see apps/web/lib/image.ts).
//
// Uploads are now downscaled + re-encoded on the way in, but assets stored
// before that shipped are still full-size originals — and /api/media serves
// whatever is stored, so they stay slow forever until rewritten.
//
// Usage (from apps/web):  node scripts/optimize-existing-images.mjs [--dry-run]
//
// Safe to re-run: rows already at or below the target are skipped, and a row is
// only written when the re-encode actually comes out smaller.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");

// Mirrors lib/image.ts. Kept inline so this script stays runnable as plain ESM
// without pulling the TS path aliases / build step in.
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;

async function optimize(input, mimeType) {
  if (mimeType === "image/gif") return null;

  const { hasAlpha } = await sharp(input, { failOn: "none" }).metadata();
  const pipeline = sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: "inside", withoutEnlargement: true });

  return hasAlpha
    ? { data: await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer(), mimeType: "image/webp" }
    : { data: await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer(), mimeType: "image/jpeg" };
}

// Next.js loads apps/web/.env automatically; a bare node script does not.
function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set (run from apps/web, where .env lives).");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

const kb = (n) => (n / 1024).toFixed(0) + "KB";

const rows = await prisma.imageAsset.findMany({
  select: { id: true, mimeType: true, data: true, byteSize: true },
  orderBy: { byteSize: "desc" },
});

console.log(`${rows.length} asset(s), ${(rows.reduce((a, r) => a + r.byteSize, 0) / 1048576).toFixed(2)} MB total`);
if (DRY_RUN) console.log("(dry run — nothing will be written)\n");

let rewritten = 0;
let saved = 0;

for (const row of rows) {
  const before = row.data.length;
  let result;
  try {
    result = await optimize(row.data, row.mimeType);
  } catch (e) {
    console.log(`  ${row.id}  FAILED to decode (${e.message}) — left untouched`);
    continue;
  }
  if (!result) {
    console.log(`  ${row.id}  ${row.mimeType} skipped (animated/gif)`);
    continue;
  }

  const after = result.data.length;
  if (after >= before) {
    console.log(`  ${row.id}  ${kb(before)} → ${kb(after)} no gain, left untouched`);
    continue;
  }

  console.log(
    `  ${row.id}  ${row.mimeType} ${kb(before)} → ${result.mimeType} ${kb(after)}` +
      `  (-${Math.round((1 - after / before) * 100)}%)`,
  );

  if (!DRY_RUN) {
    await prisma.imageAsset.update({
      where: { id: row.id },
      data: { data: result.data, mimeType: result.mimeType, byteSize: after },
    });
  }
  rewritten++;
  saved += before - after;
}

console.log(
  `\n${DRY_RUN ? "Would rewrite" : "Rewrote"} ${rewritten} asset(s), ` +
    `saving ${(saved / 1048576).toFixed(2)} MB.`,
);

await prisma.$disconnect();
