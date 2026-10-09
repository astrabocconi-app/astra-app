// One-off: writes apps/mobile/lib/calc-legacy-ids.ts, the frozen map from the
// row positions that releases 1.1.0-1.1.3 saved grades under ("0", "1", …) to
// the stable ids of the current plans.
//   node --experimental-strip-types gen_legacy_ids.mjs
//
// The old plans are read from git (commit 4f19a05 = 1.1.3; 1.1.0-1.1.2 list the
// same rows in the same order, only renamed). A row is mapped when it is the
// same course: same year and the same name once notes are stripped (or a very
// close one with the same credits); optional slots map to the same slot of the
// same year. Everything else maps to null, and the app tells the student those
// grades could not be matched instead of attaching them to a different course.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const OLD_REV = "4f19a05";

const dir = mkdtempSync(join(tmpdir(), "legacy-ids-"));
const oldFile = join(dir, "old-plans.ts");
writeFileSync(oldFile, execFileSync("git", ["show", `${OLD_REV}:packages/shared/src/grade-plans.ts`], { cwd: root, maxBuffer: 1 << 26 }));
const OLD = (await import(pathToFileURL(oldFile).href)).GRADE_PLANS;
const NEW = (await import(pathToFileURL(join(root, "packages/shared/src/grade-plans.ts")).href)).GRADE_PLANS;

// Plans that changed key.
const ALIAS = { bachelor: { BEMACC: "CLEACC-ENG" }, master: { DSBA: "DSBA-BA" }, clmg: {} };

// Old names → what the generator now calls them (language tokens, notes stripped).
const canon = (name) => {
  const n = name.replace(/\s*\((lessons (\+|and) exam|didattica ed esame)\)\s*$/i, "").trim();
  if (/^(prima lingua|first foreign language)$/i.test(n)) return "@lang1";
  if (/^inglese \(i lingua\)/i.test(n)) return "@english";
  if (/^(seconda lingua|second( foreign)? language|lingua 2)/i.test(n)) return "@lang2";
  if (/^(lingua|eu language|foreign language)$/i.test(n)) return "@lang";
  if (/^enhancing experience/i.test(n)) return "Enhancing Experience";
  if (/^behaviou?ral skills? seminars?/i.test(n)) return "Behavioural skills seminars";
  return n;
};
const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(modulo|module)\b/g, "module")
    .replace(/\boppure\b/g, "or")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const grams = (s) => {
  const t = ` ${norm(s)} `;
  const out = new Set();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
};
const sim = (a, b) => {
  const x = grams(a), y = grams(b);
  let inter = 0;
  for (const g of x) if (y.has(g)) inter++;
  return (2 * inter) / (x.size + y.size || 1);
};
// Names the old lists spelled differently from the annex, by hand.
const SAME = [
  ["emerging topics in cybersecurity (at bocconi)", "introduction to cyber risk"],
  ["major compulsory course", "business-government relations or international organizations management (your choice)"],
  ["business game", "international finance challenge"],
  ["compulsory course of your choice", "advanced microeconomics or advanced macroeconomics (your choice)"],
  ["critical thinking and complex decision making seminar", "behavioural skills and leadership seminar"],
  ["sustainable leadership seminar", "sustainability: policy decision-making and evaluation"],
  ["quantitative methods for management", "applied research in cultural industries and institutions - module i (quantitative methods for management)"],
];

const out = { bachelor: {}, master: {}, clmg: {} };
const report = [];
for (const type of Object.keys(OLD)) {
  for (const [oldKey, oldRows] of Object.entries(OLD[type])) {
    const newKey = ALIAS[type][oldKey] ?? oldKey;
    const newRows = NEW[type][newKey];
    if (!newRows) {
      out[type][oldKey] = { plan: null, ids: oldRows.map(() => null) };
      report.push(`${type} ${oldKey}: plan removed`);
      continue;
    }
    const used = new Set();
    // k-th optional slot of each year, old and new.
    const slotsNew = {};
    for (const r of newRows) if (r.k === "o" || r.k === "s") (slotsNew[r.y] ??= []).push(r.id);
    const seenOpt = {};
    const ids = oldRows.map((r, i) => {
      const tag = `${type} ${oldKey}[${i}] y${r.y} ${r.k} ${r.c} "${r.n}"`;
      let hit = null;
      if (r.k === "o" || r.k === "s" || (r.k === "g" && r.n.startsWith("#"))) {
        const n = (seenOpt[r.y] = (seenOpt[r.y] ?? 0) + 1);
        hit = slotsNew[r.y]?.[n - 1] ?? null;
        if (hit && newRows.find((x) => x.id === hit).c !== r.c) hit = null;
      } else if (r.k === "i" && type === "master") {
        hit = null; // an MSc internship is now a fixed pass/fail row; the old row was a phantom grade or an optional
      } else {
        const cands = newRows.filter((x) => x.y === r.y && !used.has(x.id) && x.k !== "o" && x.k !== "s");
        const oldName = canon(r.n);
        const n0 = norm(oldName);
        const lower = r.n.toLowerCase();
        hit =
          cands.find(
            (x) => norm(x.n) === n0 || SAME.some(([a, b]) => lower === a && x.n.toLowerCase() === b),
          )?.id ?? null;
        // Same course moved to another year (BIG-DSO climate change).
        if (!hit) {
          const moved = newRows.filter((x) => !used.has(x.id) && x.k !== "o" && x.k !== "s" && norm(x.n) === n0);
          if (moved.length === 1) hit = moved[0].id;
        }
        if (!hit) {
          let best = null, bestSim = 0;
          for (const x of cands) {
            const s = sim(r.n, x.n);
            if (x.c === r.c && s > bestSim) (best = x), (bestSim = s);
          }
          if (best && bestSim >= 0.72) hit = best.id;
        }
      }
      if (hit) used.add(hit);
      const target = hit && newRows.find((x) => x.id === hit);
      // A graded course that is now pass/fail can't carry its grade.
      if (target && r.k === "g" && target.k === "p") {
        report.push(`DROP (now pass/fail) ${tag} -> ${target.id}`);
        return null;
      }
      if (!hit) report.push(`UNMATCHED ${tag}`);
      else if (norm(newRows.find((x) => x.id === hit).n) !== norm(canon(r.n)) && !r.n.startsWith("#"))
        report.push(`fuzzy ${tag} -> ${hit} "${newRows.find((x) => x.id === hit).n}"`);
      return hit;
    });
    out[type][oldKey] = { plan: newKey, ids };
  }
}

const lines = [];
lines.push(`// GENERATED once by bocconi-scraper/grade-plans/gen_legacy_ids.mjs. Do not edit.`);
lines.push(`// Releases 1.1.0-1.1.3 saved grades under the row's position in the plan ("0", "1", …).`);
lines.push(`// Rows now have stable ids; this maps the old positions of those plans (as of 1.1.3) to`);
lines.push(`// them. null = no longer the same course: the grade is dropped and the student is told.`);
lines.push(`// Safe to delete once nobody can still be on a 1.1.x save (one release after the one that ships it).`);
lines.push(``);
lines.push(`export const LEGACY_PLAN_ALIASES: Record<string, Record<string, string>> = ${JSON.stringify(ALIAS, null, 2)};`);
lines.push(``);
lines.push(`export const LEGACY_ROW_IDS: Record<string, Record<string, (string | null)[]>> = {`);
for (const type of Object.keys(out)) {
  lines.push(`  ${type}: {`);
  for (const [oldKey, v] of Object.entries(out[type])) {
    lines.push(`    ${JSON.stringify(oldKey)}: ${JSON.stringify(v.ids)},`);
  }
  lines.push(`  },`);
}
lines.push(`};`);
writeFileSync(join(root, "apps/mobile/lib/calc-legacy-ids.ts"), lines.join("\n") + "\n");
console.log(report.join("\n"));
console.log(`\nwrote ${lines.length} lines`);
