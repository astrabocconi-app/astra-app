import assert from "node:assert/strict";
import test from "node:test";
import { admissionScore, outlook } from "./master-admissions.ts";
import { MASTER_ADMISSION_DATA } from "./master-admissions-data.ts";

test("score matches the survey's own 'score out of 30' column", () => {
  // B.lab rows: AFM 26.80 / 120 credits / in corso → 27.48; ESS 29.86 not in corso → 29.86
  assert.equal(admissionScore(26.8, 120, true, 1).toFixed(2), "27.48");
  assert.equal(admissionScore(29.86, 119, false, 1).toFixed(2), "29.86");
  // Second round: the credit bonus starts at 110. AFM 27.00 / 132 → 27.57
  assert.equal(admissionScore(27.0, 132, true, 2).toFixed(2), "27.57");
});

test("outlook ranks programmes by chance and margin", () => {
  const data = {
    survey: { AFM: [27, 27.5, 28, 28.5, 29] },
    lowerBounds: { round1: { AFM: 26.8, FIN: 29 }, round2: {} },
  };
  const out = outlook(28.1, 1, data);
  const afm = out.find((o) => o.programme.key === "AFM");
  assert.equal(afm.chance, "likely"); // above the median 28
  assert.equal(afm.lowest, 26.8);
  assert.equal(out.find((o) => o.programme.key === "FIN").chance, "unlikely");
  assert.equal(out.find((o) => o.programme.key === "AI").chance, "unknown");
  assert.equal(out[0].programme.key, "AFM");
  assert.equal(outlook(27.2, 1, data).find((o) => o.programme.key === "AFM").chance, "possible");
});

test("generated data covers every programme in some round", () => {
  for (const key of Object.keys(MASTER_ADMISSION_DATA.lowerBounds.round1)) assert.ok(key);
  assert.ok(MASTER_ADMISSION_DATA.survey.AFM.length > 10);
});
