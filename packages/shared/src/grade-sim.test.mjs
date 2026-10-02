import assert from "node:assert/strict";
import test from "node:test";
import { simulate, countCombinations } from "./grade-calc.ts";

const exams = (...credits) => credits.map((credits, i) => ({ id: String(i), credits }));

test("all 29s needed: a 30 and a 28 work too", () => {
  const sim = simulate(exams(8, 8), 29 * 16);
  assert.equal(sim.uniform, 29);
  assert.equal(sim.neededAverage, 29);
  assert.ok(sim.mixes.some((m) => m.high === 30 && m.low === 28 && m.highCount === 1));
  for (const m of sim.mixes) {
    assert.ok(m.grades[0] * 8 + m.grades[1] * 8 >= 29 * 16, "every mix reaches the target");
  }
});

test("bigger exams take the high grade first", () => {
  const sim = simulate(exams(6, 12), 27 * 18);
  const mix = sim.mixes.find((m) => m.highCount === 1);
  assert.ok(mix);
  assert.equal(mix.grades[1], mix.high);
});

test("impossible and already-safe targets", () => {
  assert.equal(simulate(exams(6, 6), 32 * 12).impossible, true);
  assert.equal(simulate(exams(6, 6), 32 * 12).uniform, null);
  const safe = simulate(exams(6, 6), 10 * 12);
  assert.equal(safe.alreadySafe, true);
  assert.equal(safe.uniform, 18);
});

test("combination count matches brute force, with half credits", () => {
  const credits = [7.5, 6, 6];
  const need = 27 * 19.5;
  let brute = 0;
  for (let a = 18; a <= 31; a++)
    for (let b = 18; b <= 31; b++)
      for (let c = 18; c <= 31; c++) if (a * 7.5 + b * 6 + c * 6 >= need) brute++;
  const { reaching, total } = countCombinations(credits, need);
  assert.equal(reaching, brute);
  assert.equal(total, 14 ** 3);
});
