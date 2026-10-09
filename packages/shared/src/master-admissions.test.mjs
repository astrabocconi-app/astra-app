import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  admissionScore,
  outlook,
  standing,
  median,
  scoreForInputs,
  parseDecimal,
  MASTER_PROGRAMMES,
  MIN_CREDITS,
} from "./master-admissions.ts";
import { MASTER_ADMISSION_DATA as DATA } from "./master-admissions-data.ts";

const scraper = (f) =>
  JSON.parse(readFileSync(new URL(`../../../bocconi-scraper/master-admissions/${f}`, import.meta.url), "utf8"));
const round1 = scraper("blab-round1-rows.json").rows;
const round2 = scraper("blab-round2-rows.json").rows;
const bounds = scraper("lower-bounds.json");

test("score matches the survey's own 'score out of 30' column", () => {
  // B.lab rows: AFM 26.80 / 120 credits / in corso → 27.48; ESS 29.86 not in corso → 29.86
  assert.equal(admissionScore(26.8, 120, true, 1).toFixed(2), "27.48");
  assert.equal(admissionScore(29.86, 119, false, 1).toFixed(2), "29.86");
  // Second round: the credit bonus starts at 110. AFM 27.00 / 132 → 27.57
  assert.equal(admissionScore(27.0, 132, true, 2).toFixed(2), "27.57");
});

test("the formula reproduces every transcribed B.lab row (226 first round, 15 second)", () => {
  assert.equal(round1.length, 226);
  assert.equal(round2.length, 15);
  for (const [rows, round] of [[round1, 1], [round2, 2]]) {
    for (const r of rows) {
      const mine = admissionScore(r.gpa, r.credits, r.inCorso, round);
      assert.ok(Math.abs(mine - r.score) < 0.0075, `${r.p} ${r.gpa}/${r.credits}: ${mine.toFixed(4)} vs ${r.score}`);
    }
  }
});

test("shipped data is the transcription, and its lowest values are the PDF's lower-bound tables", () => {
  const group = (rows) => {
    const out = {};
    for (const r of rows) (out[r.p] ??= []).push(r.score);
    for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
    return out;
  };
  assert.deepEqual(DATA.blab.round1, group(round1));
  assert.deepEqual(DATA.blab.round2, group(round2));
  for (const [k, v] of Object.entries(DATA.blab.round1)) assert.equal(v[0], bounds.round1[k], `round 1 ${k}`);
  for (const [k, v] of Object.entries(DATA.blab.round2)) assert.equal(v[0], bounds.round2[k], `round 2 ${k}`);
  assert.deepEqual(Object.keys(bounds.round1).sort(), Object.keys(DATA.blab.round1).sort());
  assert.equal(DATA.blab.round2.ESS.length, 1);
});

test("ASTRA's scores are sorted, in range and nothing was invented for unreadable credits", () => {
  for (const [k, v] of Object.entries(DATA.astra)) {
    assert.ok(MASTER_PROGRAMMES.some((p) => p.key === k), k);
    assert.deepEqual(v, [...v].sort((a, b) => a - b));
    for (const s of v) assert.ok(s >= 18 && s <= 35, `${k} ${s}`);
  }
  // 158 usable admits; the nine in-corso answers with unreadable credits are left out.
  assert.equal(Object.values(DATA.astra).reduce((n, v) => n + v.length, 0), 158);
  assert.deepEqual(DATA.cycles, { astra: "2025-26", blab: "2024-25" });
});

test("median is the true median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3]), 3);
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 10]), 2.5); // used to pick the upper middle (3)
  assert.equal(median([27, 27.5, 28, 28.5, 29, 30]), 28.25);
});

test("standing: above the lowest admit, close (within 0.5 below), below", () => {
  assert.equal(standing(28, null), "none");
  assert.equal(standing(27.4, 27.4), "above"); // exactly the lowest admit counts as above
  assert.equal(standing(30, 27.4), "above");
  assert.equal(standing(26.9, 27.4), "close"); // exactly 0.5 below, despite float noise
  assert.equal(standing(27.3, 27.4), "close");
  assert.equal(standing(26.89, 27.4), "below");
  assert.equal(standing(20, 27.4), "below");
  // 0.1 + 0.2 style noise never flips a boundary
  assert.equal(standing(26.8 - 0.5, 26.8), "close");
  assert.equal(standing(0.1 + 0.2, 0.3), "above");
});

const data = (astra = {}, round1 = {}, round2 = {}) => ({ astra, blab: { round1, round2 } });

test("outlook pools both surveys, shows n, and only gives a median from 5 answers", () => {
  const d = data({ AFM: [27, 28, 29] }, { AFM: [26.8, 27.5], FIN: [29] });
  const out = outlook(28.1, 1, d);
  const afm = out.find((o) => o.programme.key === "AFM");
  assert.equal(afm.admits, 5);
  assert.equal(afm.lowest, 26.8);
  assert.equal(afm.median, 27.5); // [26.8, 27, 27.5, 28, 29]
  assert.equal(afm.lowData, false);
  assert.equal(afm.standing, "above");
  const fin = out.find((o) => o.programme.key === "FIN");
  assert.equal(fin.admits, 1);
  assert.equal(fin.median, null);
  assert.equal(fin.lowData, true);
  assert.equal(fin.lowest, 29);
  assert.equal(fin.standing, "below");
  assert.equal(out.find((o) => o.programme.key === "AI").standing, "none");
  assert.equal(out.find((o) => o.programme.key === "AI").admits, 0);
});

test("small samples: no median and never a margin made up from them", () => {
  const d = data({ AI: [27.2, 28.1] }, { AI: [28.35, 28.73] });
  const ai = outlook(27.0, 1, d).find((o) => o.programme.key === "AI");
  assert.equal(ai.admits, 4);
  assert.equal(ai.median, null);
  assert.equal(ai.lowData, true);
  assert.equal(ai.lowest, 27.2);
  // 0.2 under the lowest of four answers is "close", not an invented pass or fail
  assert.equal(ai.standing, "close");
  assert.ok(Math.abs(ai.margin - -0.2) < 1e-9);
});

test("round 2: one respondent per programme, lowest only, no +0.5 margin", () => {
  const d = data({ ESS: [28] }, { ESS: [29] }, { ESS: [31.03], FIN: [29.52] });
  const out = outlook(30.6, 2, d);
  const ess = out.find((o) => o.programme.key === "ESS");
  assert.equal(ess.admits, 1);
  assert.equal(ess.lowest, 31.03); // round 1 data does not leak into round 2
  assert.equal(ess.median, null);
  assert.equal(ess.standing, "close");
  const fin = out.find((o) => o.programme.key === "FIN");
  assert.equal(fin.standing, "above");
  // a score just above the single respondent's is "above", exactly that and no more
  assert.equal(outlook(31.04, 2, d).find((o) => o.programme.key === "ESS").standing, "above");
  assert.equal(outlook(25, 2, d).find((o) => o.programme.key === "AI").standing, "none");
});

test("programmes missing from the data are 'none' and sort last", () => {
  const out = outlook(28, 1, data({ AFM: [27] }));
  assert.equal(out.length, MASTER_PROGRAMMES.length);
  assert.equal(out[0].programme.key, "AFM");
  assert.ok(out.slice(1).every((o) => o.standing === "none" && o.lowest === null && o.margin === null));
});

test("sorted by standing, then by how far above/below", () => {
  const d = data({ AFM: [25], AI: [27], CYBER: [28.1], DSBA: [29.5], ESS: [27.9] });
  const out = outlook(28, 1, d).filter((o) => o.standing !== "none").map((o) => `${o.programme.key}:${o.standing}`);
  assert.deepEqual(out, ["AFM:above", "AI:above", "ESS:above", "CYBER:close", "DSBA:below"]);
});

test("with the real data, nobody is told they are 'above' on a programme with no admits", () => {
  for (const round of [1, 2]) {
    for (const o of outlook(29, round, DATA)) {
      if (o.admits === 0) assert.equal(o.standing, "none", o.programme.key);
      else assert.notEqual(o.standing, "none");
    }
  }
  // every programme has something in round 1
  assert.ok(outlook(29, 1, DATA).every((o) => o.admits > 0));
  // round 2 has 15 single respondents
  assert.equal(outlook(29, 2, DATA).filter((o) => o.admits === 1).length, 15);
});

test("a score of 27.5 in round 1 (audit example) is no longer 'likely' for AI or ACME on two answers", () => {
  const out = outlook(27.5, 1, DATA);
  const ai = out.find((o) => o.programme.key === "AI");
  const acme = out.find((o) => o.programme.key === "ACME");
  assert.equal(ai.median > 28, true); // B.lab's four AI admits are pooled in
  assert.equal(ai.admits, 6);
  assert.equal(acme.admits, 13);
});

test("input validation: blank credits are not the minimum, range is min..200", () => {
  const ok = { gpa: "27,45", credits: "120", inCorso: true, round: 1 };
  assert.equal(scoreForInputs(ok).score.toFixed(2), admissionScore(27.45, 120, true, 1).toFixed(2));
  assert.deepEqual({ ...scoreForInputs({ ...ok, credits: "" }) }, { score: null, error: null, missing: "credits" });
  assert.equal(scoreForInputs({ ...ok, credits: "60" }).error, "credits"); // below the 90 needed to apply
  assert.equal(scoreForInputs({ ...ok, credits: "89" }).error, "credits");
  assert.ok(scoreForInputs({ ...ok, credits: "90" }).score > 0);
  assert.equal(scoreForInputs({ ...ok, credits: "201" }).error, "credits");
  assert.equal(scoreForInputs({ ...ok, credits: "999" }).error, "credits");
  assert.equal(scoreForInputs({ ...ok, credits: "120.5" }).error, "credits");
  // the second round needs 110
  assert.equal(scoreForInputs({ ...ok, round: 2, credits: "100" }).error, "credits");
  assert.ok(scoreForInputs({ ...ok, round: 2, credits: "110" }).score > 0);
  // not in corso: credits are irrelevant, the score is the GPA
  assert.equal(scoreForInputs({ ...ok, inCorso: false, credits: "" }).score, 27.45);
  assert.equal(scoreForInputs({ ...ok, inCorso: false, credits: "12" }).score, 27.45);
  // GPA
  assert.equal(scoreForInputs({ ...ok, gpa: "" }).missing, "gpa");
  assert.equal(scoreForInputs({ ...ok, gpa: "17,9" }).error, "gpa");
  assert.equal(scoreForInputs({ ...ok, gpa: "31,1" }).error, "gpa");
  assert.equal(scoreForInputs({ ...ok, gpa: "abc" }).error, "gpa");
  assert.equal(scoreForInputs({ ...ok, gpa: "27.45" }).score !== null, true);
  assert.deepEqual([MIN_CREDITS[1], MIN_CREDITS[2]], [90, 110]);
});

test("parseDecimal accepts comma or dot and nothing else", () => {
  assert.equal(parseDecimal("27,45"), 27.45);
  assert.equal(parseDecimal(" 27.45 "), 27.45);
  assert.equal(parseDecimal("27"), 27);
  assert.equal(parseDecimal(""), null);
  assert.equal(parseDecimal("27,"), null);
  assert.equal(parseDecimal("2,7,4"), null);
  assert.equal(parseDecimal("-3"), null);
  assert.equal(parseDecimal("1e3"), null);
});
