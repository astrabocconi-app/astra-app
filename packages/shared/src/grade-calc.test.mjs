import assert from "node:assert/strict";
import test from "node:test";
import {
  newState,
  rowsFromPlan,
  weightedAverage,
  admissionAverage,
  graduation,
  planForTarget,
  reachesTarget,
  isGraded,
  internshipSlotId,
  extraPoints,
  LODE,
} from "./grade-calc.ts";
import { GRADE_PLANS, PLAN_META } from "./grade-plans.ts";

// [name, credits, kind, module]
const plan = (...rows) => rows.map(([n, c, k = "g", m], i) => ({ id: `1.r${i}`, n, c, y: 1, k, m }));
const withGrades = (state, grades) => ({
  ...state,
  rows: state.rows.map((r, i) => ({ ...r, grade: grades[i] ?? null })),
});

test("weighted average: 30L counts 31, seminars are left out", () => {
  const s = withGrades(newState("bachelor", "X", plan(["A", 10], ["B", 5], ["Sem", 1, "p"])), [31, 25, 30]);
  assert.equal(weightedAverage(s).average, (31 * 10 + 25 * 5) / 15);
});

test("a finished module exam counts once, rounded half up", () => {
  const s = withGrades(newState("bachelor", "X", plan(["M1", 9, "g", "Eco"], ["M2", 8, "g", "Eco"])), [27, 24]);
  // (27·9 + 24·8) / 17 = 25.59 → 26 over 17 credits
  assert.equal(weightedAverage(s).average, 26);
  // exactly x.5 rounds up, in integers: (28·6 + 27·6)/12 = 27.5 → 28
  const half = withGrades(newState("bachelor", "X", plan(["M1", 6, "g", "Eco"], ["M2", 6, "g", "Eco"])), [28, 27]);
  assert.equal(weightedAverage(half).average, 28);
  // an unfinished module counts row by row
  const open = withGrades(newState("bachelor", "X", plan(["M1", 6, "g", "Eco"], ["M2", 6, "g", "Eco"])), [28]);
  assert.equal(weightedAverage(open).average, 28);
  assert.equal(weightedAverage(open).gradedCredits, 6);
});

test("master admissions count modules one by one", () => {
  const s = withGrades(newState("bachelor", "X", plan(["M1", 9, "g", "Eco"], ["M2", 8, "g", "Eco"])), [27, 24]);
  assert.equal(weightedAverage(s).average, 26);
  assert.equal(admissionAverage(s), (27 * 9 + 24 * 8) / 17);
});

test("internship replaces the last optional slot that allows it", () => {
  const s = { ...newState("bachelor", "X", plan(["A", 6], ["#1", 6, "o"], ["#2", 6, "s"])), internship: true };
  assert.equal(internshipSlotId(s), "1.r2");
  assert.equal(isGraded(s.rows[2], s), false);
  assert.equal(weightedAverage(s).totalCredits, 12);
});

test("an MSc plan has no internship switch: the row is pass/fail and never graded", () => {
  const s = newState("master", "X", plan(["A", 6], ["Internship", 8, "p"]));
  assert.equal(s.internship, false);
  assert.equal(isGraded(s.rows[1], s), false);
  assert.equal(weightedAverage(s).totalCredits, 6);
});

test("rows keep the plan's ids", () => {
  assert.deepEqual(
    rowsFromPlan(plan(["A", 6], ["B", 6])).map((r) => r.id),
    ["1.r0", "1.r1"],
  );
});

test("bachelor graduation: base + thesis + bonus, lode needs 111 and thesis ≥ 3", () => {
  const s = { ...newState("bachelor", "X", plan(["A", 6])), thesis: 4, bonus: true };
  const g = graduation(s, 29);
  assert.ok(Math.abs(g.base - 106.333) < 1e-3);
  assert.equal(g.grade, 110);
  assert.equal(g.lodePossible, true); // 111.33
  assert.equal(graduation({ ...s, thesis: 2, bonus: true }, 30).lodePossible, false);
});

test("thesis points can be fractions", () => {
  const s = { ...newState("bachelor", "X", plan(["A", 6])), thesis: 3.5 };
  assert.equal(extraPoints(s), 3.5);
  // 27 → 99 + 3.5 = 102.5 → 103
  assert.equal(graduation(s, 27).grade, 103);
  assert.equal(graduation({ ...s, thesis: 3 }, 27).grade, 102);
});

test("exact .5 totals round up whatever the credits (no float drift)", () => {
  // 66 credits at 28 and 66 at 29: average 28.5, base exactly 104.5 → 105.
  const s = { ...withGrades(newState("bachelor", "X", plan(["A", 66], ["B", 66])), [28, 29]), thesis: 0 };
  const a = weightedAverage(s);
  assert.equal(graduation(s, a.ratio).grade, 105);
  assert.equal(graduation(s, a.ratio).total, 104.5);
  // The same through a typed average.
  assert.equal(graduation(s, 28.5).grade, 105);
  // Every multiple of 22 credits: the case that used to round down.
  for (let credits = 22; credits <= 176; credits += 22) {
    const t = { ...withGrades(newState("bachelor", "X", plan(["A", credits / 2], ["B", credits / 2])), [28, 29]), thesis: 0 };
    assert.equal(graduation(t, weightedAverage(t).ratio).grade, 105, `${credits} credits`);
  }
});

test("lode is judged on the unrounded total", () => {
  const s = { ...newState("bachelor", "X", plan(["A", 6])), thesis: 4, bonus: false };
  // average 28.9 → 105.97 + 4 = 109.97; push to 110.6 with a typed average
  const just = graduation({ ...s, bonus: true }, 28.5); // 104.5 + 5 = 109.5
  assert.equal(just.lodePossible, false);
  const g = graduation({ ...s, bonus: true }, 29.2); // 107.07 + 5 = 112.07
  assert.equal(g.lodePossible, true);
  // total 110.5..110.99 rounds to 111 but is not 111: no lode.
  const near = graduation({ ...s, bonus: true }, 28.9); // 105.97 + 5 = 110.97
  assert.ok(near.total > 110.5 && near.total < 111);
  assert.equal(near.rounded, 111);
  assert.equal(near.grade, 110);
  assert.equal(near.lodePossible, false);
  // exactly 111
  const t111 = graduation({ ...s, bonus: true, thesis: 4 }, (106 * 30) / 110); // base exactly 106 → 111
  assert.equal(t111.lodePossible, true);
});

test("master extras are capped at 8 (the Italian text caps the whole total); applied thesis tops out at 5", () => {
  const s = { ...newState("master", "X", plan(["A", 6])), thesis: 8, onTime: true, athlete: true };
  assert.equal(graduation(s, 30).extras, 8);
  assert.equal(graduation({ ...s, thesisType: "applied", thesis: 8, onTime: false, athlete: false }, 30).extras, 5);
  assert.equal(extraPoints({ ...s, thesis: 6, athlete: false }), 7);
  assert.equal(extraPoints({ ...s, thesis: 7, athlete: true }), 8);
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
  assert.equal(p.met, null);
});

test("target 110 e lode needs a total of 111, not 110.5", () => {
  const s = { ...withGrades(newState("bachelor", "X", plan(["A", 6], ["B", 6])), [30]), thesis: 4, bonus: true, target: 111 };
  const p = planForTarget(s);
  // total ≥ 111 → average ≥ 106·30/110 = 28.909 over 12 credits → B ≥ 27.8 → 28
  assert.equal(p.uniform, 28);
  assert.ok(Math.abs(p.overallAverage - (106 * 30) / 110) < 1e-9);
  assert.equal(p.lodeBlocked, false);
  // A final paper below 3 points can't earn lode at all.
  const blocked = planForTarget({ ...s, thesis: 2 });
  assert.equal(blocked.lodeBlocked, true);
  assert.equal(blocked.impossible, true);
});

test("with no exams left the plan says whether the target is met", () => {
  const s = { ...withGrades(newState("bachelor", "X", plan(["A", 6])), [30]), thesis: 4, bonus: true };
  assert.equal(planForTarget({ ...s, target: 110 }).met, true);
  assert.equal(planForTarget({ ...s, target: 110 }).noneLeft, true);
  assert.equal(planForTarget({ ...s, target: 111 }).met, true); // 110.0 + 5 = 115.. lode possible
  assert.equal(planForTarget({ ...withGrades(s, [18]), target: 110 }).met, false);
});

// ── The planner agrees with the graduation panel, module rounding included ──
// A reference implementation with exact rationals (BigInt), written
// independently of grade-calc.ts: final grade of a finished transcript.
function reference(state) {
  const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));
  const frac = (n, d) => {
    const g = gcd(n < 0n ? -n : n, d) || 1n;
    return [n / g, d / g];
  };
  const add = ([a, b], [c, d]) => frac(a * d + c * b, b * d);
  const graded = state.rows.filter((r) => isGraded(r, state));
  const done = graded.filter((r) => r.grade != null);
  if (!done.length) return null;
  let points = 0n;
  let credits = 0n;
  const half = (c) => BigInt(Math.round(c * 2));
  const modules = new Map();
  for (const r of done) {
    if (!r.module) {
      points += half(r.credits) * BigInt(r.grade);
      credits += half(r.credits);
    } else modules.set(r.module, [...(modules.get(r.module) ?? []), r]);
  }
  for (const [m, rows] of modules) {
    const whole = graded.filter((r) => r.module === m).length === rows.length;
    if (whole) {
      const c = rows.reduce((n, r) => n + half(r.credits), 0n);
      const p = rows.reduce((n, r) => n + half(r.credits) * BigInt(r.grade), 0n);
      // mean rounded half up
      const rounded = (2n * p + c) / (2n * c);
      points += c * rounded;
      credits += c;
    } else {
      for (const r of rows) {
        points += half(r.credits) * BigInt(r.grade);
        credits += half(r.credits);
      }
    }
  }
  const avg = frac(points, credits);
  const base = frac(avg[0] * 110n, avg[1] * 30n);
  const extra2 = BigInt(Math.round(extraPoints(state) * 2));
  const total = add(base, frac(extra2, 2n));
  const rounded = (2n * total[0] + total[1]) / (2n * total[1]);
  return { total, rounded: Number(rounded), lode: total[0] >= 111n * total[1] };
}

// Small deterministic PRNG so failures reproduce.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomState(rand, openMax) {
  const n = 4 + Math.floor(rand() * 6);
  const rows = [];
  let mod = 0;
  for (let i = 0; i < n; i++) {
    const c = [3, 5, 6, 7, 7.5, 8, 9, 10][Math.floor(rand() * 8)];
    const asModule = rand() < 0.35 && i + 1 < n;
    if (asModule) {
      mod++;
      rows.push({ n: `M${mod}a`, c, k: "g", m: `Mod${mod}` }, { n: `M${mod}b`, c: [4, 6, 8][Math.floor(rand() * 3)], k: "g", m: `Mod${mod}` });
      i++;
    } else rows.push({ n: `E${i}`, c, k: rand() < 0.1 ? "p" : "g" });
  }
  const type = ["bachelor", "master", "clmg"][Math.floor(rand() * 3)];
  const s = newState(type, "X", rows.map((r, i) => ({ id: `1.r${i}`, n: r.n, c: r.c, y: 1, k: r.k, m: r.m })));
  const graded = s.rows.filter((r) => isGraded(r, s));
  const open = new Set();
  const want = Math.min(graded.length, 1 + Math.floor(rand() * openMax));
  while (open.size < want) open.add(graded[Math.floor(rand() * graded.length)].id);
  s.rows = s.rows.map((r) => ({ ...r, grade: isGraded(r, s) && !open.has(r.id) ? 18 + Math.floor(rand() * 14) : null }));
  s.thesis = Math.floor(rand() * 17) / 2;
  s.bonus = rand() < 0.5;
  s.onTime = rand() < 0.5;
  s.athlete = rand() < 0.3;
  s.target = 90 + Math.floor(rand() * 22);
  return s;
}

test("graduation() equals an exact rational reference on random transcripts", () => {
  const rand = rng(12345);
  for (let i = 0; i < 3000; i++) {
    const s = randomState(rand, 1);
    const full = { ...s, rows: s.rows.map((r) => (isGraded(r, s) && r.grade == null ? { ...r, grade: 18 + Math.floor(rand() * 14) } : r)) };
    const ref = reference(full);
    const avg = weightedAverage(full);
    if (!ref) {
      assert.equal(avg.ratio, null);
      continue;
    }
    const g = graduation(full, avg.ratio);
    assert.equal(g.rounded, ref.rounded, `rounded, case ${i}`);
    const lodeOk =
      full.type === "bachelor" ? Math.min(full.thesis, 4) >= 3 : full.type === "clmg" ? extraPoints(full) >= 6 : true;
    assert.equal(g.lodePossible, ref.lode && lodeOk, `lode, case ${i}`);
  }
});

test("planForTarget: simplest grade, safe and impossible flags equal brute force, with modules", () => {
  const rand = rng(777);
  let checked = 0;
  for (let i = 0; i < 2500; i++) {
    const s = randomState(rand, 4);
    const open = s.rows.filter((r) => isGraded(r, s) && r.grade == null);
    if (!open.length) continue;
    const reaches = (u) => {
      const t = { ...s, rows: s.rows.map((r) => (open.includes(r) ? { ...r, grade: u } : r)) };
      const ref = reference(t);
      if (!ref) return false;
      return s.target >= 111
        ? ref.lode && (s.type !== "bachelor" || Math.min(s.thesis, 4) >= 3) && (s.type !== "clmg" || extraPoints(s) >= 6)
        : ref.rounded >= s.target;
    };
    let truth = null;
    for (let u = 18; u <= 31; u++) if (reaches(u)) { truth = u; break; }
    const p = planForTarget(s);
    assert.equal(p.uniform, truth, `uniform, case ${i}`);
    assert.equal(p.alreadySafe, reaches(18), `safe, case ${i}`);
    assert.equal(p.impossible, !reaches(31), `impossible, case ${i}`);
    // every suggested mix really reaches the target, and is no wasteful
    for (const m of p.mixes) {
      const t = { ...s, rows: s.rows.map((r) => (open.includes(r) ? { ...r, grade: m.grades[open.indexOf(r)] } : r)) };
      assert.equal(reachesTarget(t), true, `mix reaches, case ${i}`);
      assert.ok(m.high > p.uniform && m.low < p.uniform, "mix straddles the simplest grade");
      assert.ok(m.high <= 30 || p.mixes.every((x) => x.high === 31), "lode only when no plain mix exists");
    }
    checked++;
  }
  assert.ok(checked > 1500);
});

test("end game on a real plan: module rounding changes what is needed", () => {
  // CLEAM, target 102, only "Matematica - Modulo 2" left, module 1 = 29 (audit case).
  const rows = rowsFromPlan(GRADE_PLANS.bachelor.CLEAM);
  const s0 = newState("bachelor", "CLEAM", GRADE_PLANS.bachelor.CLEAM);
  const last = rows.find((r) => r.name.startsWith("Matematica - Modulo 2"));
  const m1 = rows.find((r) => r.name.startsWith("Matematica - Modulo 1"));
  const s = {
    ...s0,
    thesis: 3,
    target: 102,
    rows: s0.rows.map((r) => ({
      ...r,
      grade: r.id === last.id ? null : r.id === m1.id ? 29 : isGradedRow(r, s0) ? 27 : null,
    })),
  };
  const p = planForTarget(s);
  // The plan is exactly what the graduation panel would say.
  const at = (u) => reachesTarget({ ...s, rows: s.rows.map((r) => (r.id === last.id ? { ...r, grade: u } : r)) });
  assert.equal(p.uniform, [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].find((u) => at(u)));
  assert.equal(at(p.uniform), true);
  if (p.uniform > 18) assert.equal(at(p.uniform - 1), false);
});
function isGradedRow(r, s) {
  return isGraded(r, s);
}

// ── Generated plans ───────────────────────────────────────────────────────
const MSC_THESIS = {
  CRSG: 18, AI: 18, GIO: 18, "IM-GLOBAL": 18, "IM-CONCENTRATION": 18, FINANCE: 18, "FINANCE-GLOBAL": 18,
  DAAIHS: 14, "DSBA-BA": 18, "DSBA-DS": 18, MM: 18, AFM: 18, ESS: 18, PPA: 20, TS: 14, ACME: 18, INTENT: 18, EMIT: 18,
};
const MSC_LEGACY_TOTAL = { IM: 86, CLELI: 92 };
const total = (rows) => rows.reduce((n, r) => n + r.c, 0);

test("every generated plan totals the credits the regulation says", () => {
  for (const [code, rows] of Object.entries(GRADE_PLANS.bachelor)) assert.equal(total(rows), 177, code); // + 3 final paper
  assert.equal(total(GRADE_PLANS.clmg.CLMG), 288); // + 12 thesis
  for (const [code, rows] of Object.entries(GRADE_PLANS.master)) {
    if (MSC_LEGACY_TOTAL[code]) assert.equal(total(rows), MSC_LEGACY_TOTAL[code], code);
    else assert.equal(total(rows) + MSC_THESIS[code], 120, code);
  }
  assert.deepEqual(
    Object.keys(GRADE_PLANS.master).sort(),
    [...Object.keys(MSC_THESIS), ...Object.keys(MSC_LEGACY_TOTAL)].filter((k) => k !== "EMIT" || true).sort(),
  );
});

test("plan rows have unique, well-formed ids and every plan has a cohort", () => {
  for (const [type, plans] of Object.entries(GRADE_PLANS)) {
    for (const [code, rows] of Object.entries(plans)) {
      const ids = rows.map((r) => r.id);
      assert.equal(new Set(ids).size, ids.length, `${type} ${code} ids`);
      for (const r of rows) {
        assert.match(r.id, /^[1-5]\.[a-z0-9-]+$/, `${code} ${r.n}`);
        assert.ok(!r.id.startsWith("c"), "custom exams use c… ids");
      }
      assert.ok(type in PLAN_META && code in PLAN_META[type], `${type} ${code} meta`);
    }
    assert.deepEqual(Object.keys(PLAN_META[type]).sort(), Object.keys(plans).sort());
  }
});

test("optional slots are numbered per year, so a new row in one year can't shift another", () => {
  for (const rows of Object.values(GRADE_PLANS.bachelor)) {
    for (const y of [1, 2, 3]) {
      const slots = rows.filter((r) => r.y === y && (r.k === "o" || r.k === "s"));
      assert.deepEqual(slots.map((r) => r.id), slots.map((_, i) => `${y}.o${i + 1}`));
    }
  }
});

test("MSc: internship is a fixed pass/fail row, supplementary activities are pass/fail, no switch rows", () => {
  for (const [code, rows] of Object.entries(GRADE_PLANS.master)) {
    assert.ok(!rows.some((r) => r.k === "i" || r.k === "s"), `${code} has a switch row`);
    for (const r of rows) {
      if (/^enhancing experience/i.test(r.n)) assert.equal(r.k, "p", `${code} ${r.n}`);
    }
    if (MSC_LEGACY_TOTAL[code]) continue;
    const internships = rows.filter((r) => r.n === "Internship");
    assert.equal(internships.length, 1, code);
    assert.equal(internships[0].k, "p");
    assert.equal(internships[0].c, code === "AFM" || code === "DAAIHS" ? 6 : 8);
    assert.equal(newState("master", code, GRADE_PLANS.master[code]).internship, false);
  }
});

test("MSc plans rebuilt from the 2026-27 annex", () => {
  const credits = (code, name) => GRADE_PLANS.master[code].find((r) => r.n.toLowerCase().startsWith(name.toLowerCase())).c;
  // Finance: 3 / 7 / 6 / 8, not 6 everywhere
  assert.equal(credits("FINANCE", "Financial reporting and analysis lab"), 3);
  assert.equal(credits("FINANCE", "Quantitative finance and derivatives - Module 1"), 7);
  assert.equal(credits("FINANCE", "Quantitative finance and derivatives - Module 2"), 6);
  assert.equal(credits("FINANCE", "Empirical finance"), 8);
  // DSBA: two tracks, 62 credits in year 1
  for (const code of ["DSBA-BA", "DSBA-DS"]) {
    assert.equal(GRADE_PLANS.master[code].filter((r) => r.y === 1).reduce((n, r) => n + r.c, 0), 62, code);
  }
  assert.ok(GRADE_PLANS.master["DSBA-BA"].some((r) => r.n === "Simulation and modeling"));
  assert.ok(GRADE_PLANS.master["DSBA-DS"].some((r) => r.n === "Optimization"));
  assert.ok(!GRADE_PLANS.master.DSBA);
  // INTENT replaces EMIT for new students; EMIT stays for those who started under it.
  assert.ok(GRADE_PLANS.master.INTENT.some((r) => r.n === "Intellectual property law for business"));
  assert.ok(GRADE_PLANS.master.EMIT.some((r) => /Business Economics/.test(r.n)));
  assert.equal(PLAN_META.master.EMIT.legacy, true);
});

test("MSc module pairs are grouped the same way in every plan", () => {
  for (const [code, rows] of Object.entries(GRADE_PLANS.master)) {
    const parent = (n) => n.replace(/\s*[-–]?\s*\(?\bmodule\s+(1|2|I|II)\b.*$/i, "").toLowerCase();
    const named = rows.filter((r) => /\bmodule\s+(1|2|I|II)\b/i.test(r.n) && r.k === "g");
    for (const r of named) {
      // A lone "module I" (ESS: its module II is one of the optional slots) has no partner to round with.
      if (named.filter((x) => parent(x.n) === parent(r.n)).length > 1) assert.ok(r.m, `${code}: ${r.n} should be a module`);
    }
    const groups = new Map();
    for (const r of rows) if (r.m) groups.set(r.m, (groups.get(r.m) ?? 0) + 1);
    for (const [m, n] of groups) assert.ok(n >= 2, `${code}: module group ${m} has one row`);
  }
});

test("bachelor fixes: BIG-DSO climate change in year 3, one internship slot in BEMACS, typos gone", () => {
  assert.equal(GRADE_PLANS.bachelor["BIG-DSO"].find((r) => /^Climate change/.test(r.n)).y, 3);
  assert.equal(GRADE_PLANS.bachelor.BEMACS.filter((r) => r.k === "s").length, 1);
  assert.ok(!GRADE_PLANS.bachelor.BEMACC, "BEMACC is CLEACC-ENG");
  assert.ok(GRADE_PLANS.bachelor["CLEACC-ENG"].some((r) => r.n === "Fundamentals of organization"));
  for (const rows of Object.values(GRADE_PLANS)) for (const plan of Object.values(rows)) for (const r of plan) assert.ok(!/oppure/.test(r.n));
});

test("LODE is 31", () => assert.equal(LODE, 31));
