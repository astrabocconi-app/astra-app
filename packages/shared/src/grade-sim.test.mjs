import assert from "node:assert/strict";
import test from "node:test";
import { simulate, countCombinations } from "./grade-calc.ts";

const exams = (...credits) => credits.map((credits, i) => ({ id: String(i), credits }));
const weighted = (credits, grades) => grades.reduce((n, g, i) => n + g * credits[i], 0);

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

test("no exams left: nothing to simulate, no crash", () => {
  const sim = simulate([], 0);
  assert.equal(sim.uniform, null);
  assert.deepEqual(sim.mixes, []);
  assert.equal(sim.alreadySafe, true);
  assert.equal(simulate([], 5).impossible, true);
  assert.equal(simulate(exams(6), -20).alreadySafe, true);
});

test("alternatives ask for a plain 30 before any 30 e lode (4+ exams)", () => {
  // 6 exams × 6 credits, average 28 needed (the case that used to show only 31s)
  const six = simulate(exams(6, 6, 6, 6, 6, 6), 28 * 36);
  assert.equal(six.uniform, 28);
  assert.ok(six.mixes.length > 0);
  assert.ok(six.mixes.every((m) => m.high <= 30), "no 30 e lode when a plain mix exists");
  assert.ok(six.mixes.some((m) => m.high === 30));
  // 4 exams × 6 credits, 27 needed
  const four = simulate(exams(6, 6, 6, 6), 27 * 24);
  assert.ok(four.mixes.every((m) => m.high <= 30));
  assert.ok(four.mixes.some((m) => m.high === 30));
  // 5 exams × 8 credits, 28.2 needed: 29 on every exam, or 30s and lower
  const five = simulate(exams(8, 8, 8, 8, 8), 28.2 * 40);
  assert.equal(five.uniform, 29);
  assert.ok(five.mixes.some((m) => m.high === 30));
  assert.ok(five.mixes.every((m) => m.high <= 30));
});

test("a 30 e lode appears only when a plain 30 everywhere is not enough", () => {
  // Need 30 on average: the only mixes use lode (31) above a lower 29.
  const sim = simulate(exams(6, 6, 6, 6), 29.6 * 24);
  assert.equal(sim.uniform, 30);
  assert.ok(sim.mixes.length > 0);
  assert.ok(sim.mixes.every((m) => m.high === 31 && m.low < 30));
  assert.equal(sim.mixes[0].highCount, 2);
  // Need 31 on average: no alternative at all.
  assert.deepEqual(simulate(exams(6, 6), 31 * 12).mixes, []);
});

test("mixes: sorted by exams at the high grade, then by gap; always valid, never wasteful", () => {
  for (const credits of [[6, 6, 6, 6], [8, 6, 6, 4, 12], [9, 9, 6, 6, 6, 3], [7.5, 6, 6, 5]]) {
    const total = credits.reduce((a, b) => a + b, 0);
    for (let avg = 18.5; avg <= 30.5; avg += 0.37) {
      const need = avg * total;
      const sim = simulate(exams(...credits), need);
      for (const m of sim.mixes) {
        assert.ok(weighted(credits, m.grades) >= need - 1e-9, "reaches the target");
        assert.ok(m.high > sim.uniform && m.low < sim.uniform);
        assert.equal(m.grades.filter((g) => g === m.high).length, m.highCount);
        assert.ok(m.highCount < credits.length);
        // one fewer exam at the high grade (the smallest of them back to `low`) would fall short
        const order = credits.map((c, i) => [c, i]).sort((x, y) => y[0] - x[0] || x[1] - y[1]).map(([, i]) => i);
        const fewer = credits.map(() => m.low);
        for (const i of order.slice(0, m.highCount - 1)) fewer[i] = m.high;
        assert.ok(weighted(credits, fewer) < need - 1e-9, "highCount is the smallest that works");
      }
      for (let i = 1; i < sim.mixes.length; i++) {
        const a = sim.mixes[i - 1], b = sim.mixes[i];
        assert.ok(a.highCount < b.highCount || (a.highCount === b.highCount && a.high - a.low <= b.high - b.low));
      }
    }
  }
});

test("uniform and flags agree with brute force over every grade", () => {
  for (const credits of [[6], [6, 6], [8, 6, 7.5], [3, 6, 9, 12]]) {
    const total = credits.reduce((a, b) => a + b, 0);
    for (let need = 10 * total; need <= 32 * total; need += total / 7) {
      const sim = simulate(exams(...credits), need);
      let truth = null;
      for (let g = 18; g <= 31 && truth === null; g++) if (g * total >= need - 1e-9) truth = g;
      assert.equal(sim.uniform, truth);
      assert.equal(sim.alreadySafe, 18 * total >= need - 1e-9);
      assert.equal(sim.impossible, 31 * total < need - 1e-9);
    }
  }
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

test("combination count: random cases against brute force, targets at the edges", () => {
  let seed = 99;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 4);
    const credits = Array.from({ length: n }, () => [3, 4, 5, 6, 7.5, 8, 9][Math.floor(rand() * 7)]);
    const sum = credits.reduce((a, b) => a + b, 0);
    const need = (17 + rand() * 15) * sum;
    let brute = 0;
    const walk = (k, points) => {
      if (k === n) return void (points >= need - 1e-9 && brute++);
      for (let g = 18; g <= 31; g++) walk(k + 1, points + g * credits[k]);
    };
    walk(0, 0);
    const { reaching, total } = countCombinations(credits, need);
    assert.equal(reaching, brute, `case ${i}`);
    assert.equal(total, 14 ** n);
  }
  // already reached by everything / reached by nothing
  assert.equal(countCombinations([6, 6], -5).reaching, 14 ** 2);
  assert.equal(countCombinations([6, 6], 32 * 12).reaching, 0);
});

test("too many exams left to count: no combinations, everything else still there", () => {
  const sim = simulate(exams(...Array(30).fill(6)), 26 * 180);
  assert.equal(sim.combinations, null);
  assert.equal(sim.uniform, 26);
  const small = simulate(exams(6, 6), 26 * 12);
  assert.equal(small.combinations.total, 14 ** 2);
  assert.equal(small.combinations.approximate, false);
});

test("counting 24 exams with a CLMG-size target is fast", () => {
  const t0 = Date.now();
  countCombinations(Array(24).fill(8), 27 * 24 * 8);
  assert.ok(Date.now() - t0 < 500);
});
