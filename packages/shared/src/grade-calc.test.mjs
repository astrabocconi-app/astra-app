import assert from "node:assert/strict";
import test from "node:test";
import {
  newState,
  weightedAverage,
  graduation,
  planForTarget,
  isGraded,
  internshipSlotId,
} from "./grade-calc.ts";
import { GRADE_PLANS } from "./grade-plans.ts";

const plan = (...rows) => rows.map(([n, c, k = "g", m]) => ({ n, c, y: 1, k, m }));
const withGrades = (state, grades) => ({
  ...state,
  rows: state.rows.map((r, i) => ({ ...r, grade: grades[i] ?? null })),
});

test("weighted average: 30L counts 31, seminars are left out", () => {
  const s = withGrades(newState("bachelor", "X", plan(["A", 10], ["B", 5], ["Sem", 1, "p"])), [31, 25, 30]);
  assert.equal(weightedAverage(s).average, (31 * 10 + 25 * 5) / 15);
});

test("a finished module exam counts once, rounded", () => {
  const s = withGrades(newState("bachelor", "X", plan(["M1", 9, "g", "Eco"], ["M2", 8, "g", "Eco"])), [27, 24]);
  // (27·9 + 24·8) / 17 = 25.59 → 26 over 17 credits
  assert.equal(weightedAverage(s).average, 26);
});

test("internship replaces the last optional slot that allows it", () => {
  const s = { ...newState("bachelor", "X", plan(["A", 6], ["#1", 6, "o"], ["#2", 6, "s"])), internship: true };
  assert.equal(internshipSlotId(s), "2");
  assert.equal(isGraded(s.rows[2], s), false);
  assert.equal(weightedAverage(s).totalCredits, 12);
});

test("bachelor graduation: base + thesis + bonus, lode needs 111 and thesis ≥ 3", () => {
  const s = { ...newState("bachelor", "X", plan(["A", 6])), thesis: 4, bonus: true };
  const g = graduation(s, 29);
  assert.ok(Math.abs(g.base - 106.333) < 1e-3);
  assert.equal(g.grade, 110);
  assert.equal(g.lodePossible, true); // 111.33
  assert.equal(graduation({ ...s, thesis: 2, bonus: true }, 30).lodePossible, false);
});

test("master extras are capped at 8; applied thesis tops out at 5", () => {
  const s = { ...newState("master", "X", plan(["A", 6])), thesis: 8, onTime: true, athlete: true };
  assert.equal(graduation(s, 30).extras, 8);
  assert.equal(graduation({ ...s, thesisType: "applied", thesis: 8, onTime: false, athlete: false }, 30).extras, 5);
});

test("clmg lode needs thesis + curriculum = 6", () => {
  const s = { ...newState("clmg", "X", plan(["A", 6])), thesis: 5, bonus: true };
  assert.equal(graduation(s, 29).lodePossible, true);
  assert.equal(graduation({ ...s, bonus: false }, 30).lodePossible, false);
});

test("target plan: needed grades on the exams left", () => {
  const s = { ...withGrades(newState("bachelor", "X", plan(["A", 6], ["B", 6], ["C", 6])), [27]), thesis: 4, bonus: true, target: 110 };
  const p = planForTarget(s);
  // total ≥ 109.5 → average ≥ (109.5 − 5)·30/110 = 28.5 over 18 credits
  assert.ok(Math.abs(p.overallAverage - 28.5) < 1e-9);
  assert.equal(p.uniform, 30); // (28.5·18 − 27·6) / 12 = 29.25 → 30 on both
  assert.equal(p.noneLeft, false);
});

test("every generated plan totals sensible credits", () => {
  for (const [code, rows] of Object.entries(GRADE_PLANS.bachelor)) {
    assert.equal(rows.reduce((n, r) => n + r.c, 0), 177, code);
  }
  assert.equal(GRADE_PLANS.clmg.CLMG.reduce((n, r) => n + r.c, 0), 288);
});
