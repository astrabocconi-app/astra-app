import test from "node:test";
import assert from "node:assert/strict";
import { LODE_GRADE, gradebookStats, averageTrend } from "./gradebook-stats.ts";

// Only the fields the maths reads; the API returns more.
const exam = (patch) => ({
  status: "PASSED",
  credits: 6,
  grade: 27,
  lode: false,
  passFail: false,
  examDate: "2026-01-15T00:00:00.000Z",
  ...patch,
});

test("the average is credit-weighted, not a mean of grades", () => {
  const stats = gradebookStats([
    exam({ credits: 12, grade: 30 }),
    exam({ credits: 4, grade: 20 }),
  ]);
  // (12*30 + 4*20) / 16 = 27.5 — a plain mean would say 25.
  assert.equal(stats.weightedAverage, 27.5);
  assert.equal(stats.gradedCredits, 16);
});

test("lode is worth 31", () => {
  assert.equal(LODE_GRADE, 31);
  const stats = gradebookStats([exam({ grade: 30, lode: true })]);
  assert.equal(stats.weightedAverage, 31);
});

test("planned exams stay out of the average and are counted apart", () => {
  const stats = gradebookStats([
    exam({ credits: 6, grade: 24 }),
    exam({ status: "PLANNED", credits: 8, grade: null }),
  ]);
  assert.equal(stats.weightedAverage, 24);
  assert.equal(stats.gradedCredits, 6);
  assert.equal(stats.plannedCredits, 8);
  assert.equal(stats.passedCount, 1);
  assert.equal(stats.plannedCount, 1);
});

test("a pass/fail activity earns credits but never moves the average", () => {
  const stats = gradebookStats([
    exam({ credits: 6, grade: 24 }),
    exam({ credits: 4, grade: null, passFail: true }),
  ]);
  assert.equal(stats.weightedAverage, 24);
  assert.equal(stats.gradedCredits, 6);
  assert.equal(stats.earnedCredits, 10); // both count towards the degree
});

test("no graded credits gives no average, not zero and not NaN", () => {
  const empty = gradebookStats([]);
  assert.equal(empty.weightedAverage, null);
  assert.equal(empty.earnedCredits, 0);

  const passFailOnly = gradebookStats([exam({ grade: null, passFail: true })]);
  assert.equal(passFailOnly.weightedAverage, null);
});

test("the trend is the running average after each exam, oldest first", () => {
  const trend = averageTrend([
    exam({ credits: 6, grade: 30, examDate: "2026-06-01T00:00:00.000Z" }),
    exam({ credits: 6, grade: 20, examDate: "2026-01-01T00:00:00.000Z" }),
  ]);
  assert.deepEqual(
    trend.map((point) => point.average),
    [20, 25]
  );
  assert.equal(trend[0].date, "2026-01-01T00:00:00.000Z");
});

test("an exam with no date can't be placed on the trend but still counts", () => {
  const records = [exam({ grade: 24, examDate: null }), exam({ grade: 30 })];
  assert.equal(averageTrend(records).length, 1);
  assert.equal(gradebookStats(records).passedCount, 2);
});
