import assert from "node:assert/strict";
import test from "node:test";
import { freshSave, loadSaved, toState, switchPlan, weightedAverage } from "./grade-calc.ts";
import { GRADE_PLANS } from "./grade-plans.ts";
import { LEGACY_PLAN_ALIASES, LEGACY_ROW_IDS } from "../../../apps/mobile/lib/calc-legacy-ids.ts";

const source = {
  rows: (type, plan) => GRADE_PLANS[type][plan] ?? [],
  legacyAliases: LEGACY_PLAN_ALIASES,
  legacyIds: LEGACY_ROW_IDS,
};
const load = (type, raw) => loadSaved(type, raw, source);
const rowName = (type, plan, id) => GRADE_PLANS[type][plan].find((r) => r.id === id)?.n;

// A 1.1.x save: positions as keys, no `v`.
const v1 = (plan, grades, extra = {}) => ({
  plan,
  grades,
  noGrade: [],
  credits: {},
  removed: [],
  custom: [],
  settings: { internship: false, thesis: 3, bonus: false, thesisType: "research", onTime: false, athlete: false, target: 110 },
  ...extra,
});

test("legacy map: every old position goes to one exam of the current plan, never two to the same", () => {
  for (const [type, plans] of Object.entries(LEGACY_ROW_IDS)) {
    for (const [oldPlan, ids] of Object.entries(plans)) {
      const target = LEGACY_PLAN_ALIASES[type][oldPlan] ?? oldPlan;
      const rows = GRADE_PLANS[type][target];
      assert.ok(rows, `${type} ${oldPlan} → ${target} exists`);
      const seen = new Set();
      for (const id of ids) {
        if (id === null) continue;
        assert.ok(rows.some((r) => r.id === id), `${oldPlan}: ${id} is not in ${target}`);
        assert.ok(!seen.has(id), `${oldPlan}: two old rows map to ${id}`);
        seen.add(id);
      }
    }
  }
});

// What 1.1.3 called each position, and what it must become (fixtures kept apart from the generator).
const GOLDEN = [
  // [type, oldPlan, oldIndex, oldName, expected new name or null]
  ["bachelor", "CLEAM", 0, "Economia aziendale e gestione delle imprese", "Economia aziendale e gestione delle imprese"],
  ["bachelor", "CLEAM", 8, "Inglese (I lingua)", "@english"],
  ["bachelor", "CLEACC-ENG", 15, "Foundamentals of organization", "Fundamentals of organization"],
  ["bachelor", "BIG-DSO", 14, "Climate change and sustainability (HEC)", "Climate change and sustainability (HEC)"],
  ["bachelor", "BEMACC", 8, "First foreign language", "@lang1"],
  ["master", "MM", 11, "#1", "#1"],
  ["master", "MM", 13, "Enhancing Experience (graded in 1.1.3, pass/fail now)", null],
  ["master", "MM", 16, "Internship (optional-or-internship switch, gone)", null],
  ["master", "MM", 17, "Second foreign language", "@lang2"],
  ["master", "AI", 9, "Internship", null],
  ["master", "GIO", 7, "Major compulsory course", "Business-government relations or International organizations management (your choice)"],
  ["master", "ACME", 0, "Quantitative methods for management", "Applied research in cultural industries and institutions - module I (quantitative methods for management)"],
  ["master", "CRSG", 5, "Emerging topics in cybersecurity (at Bocconi)", "Introduction to cyber risk"],
  ["master", "FINANCE", 0, "Empirical Finance (credits change 6 to 8)", "Empirical finance"],
  ["master", "DSBA", 9, "Internship", null],
  ["master", "DSBA", 4, "Statistics and Probability", "Statistics and probability"],
];

test("legacy map: golden positions land on the same course (or nowhere)", () => {
  for (const [type, oldPlan, i, , expected] of GOLDEN) {
    const id = LEGACY_ROW_IDS[type][oldPlan][i];
    const target = LEGACY_PLAN_ALIASES[type][oldPlan] ?? oldPlan;
    const name = id ? rowName(type, target, id) : null;
    if (expected === null) assert.equal(id, null, `${oldPlan}[${i}]`);
    else assert.equal(name?.toLowerCase(), expected.toLowerCase(), `${oldPlan}[${i}]`);
  }
});

test("migrating a v1 save keeps grades on the right exams and counts the ones it can't place", () => {
  // CLEAM: grades at positions 0 (Economia aziendale), 1 (Economia M1), 8 (English).
  const s = load("bachelor", v1("CLEAM", { 0: 27, 1: 30, 8: 31 }));
  assert.equal(s.v, 2);
  const byName = Object.fromEntries(Object.entries(s.grades).map(([id, g]) => [rowName("bachelor", "CLEAM", id), g]));
  assert.deepEqual(byName, {
    "Economia aziendale e gestione delle imprese": 27,
    "Economia - Modulo 1 (Microeconomia)": 30,
    "@english": 31,
  });
  assert.equal(s.notice, undefined);

  // MM: a grade on the old graded Enhancing Experience (13) can't move; the others do.
  const mm = load("master", v1("MM", { 0: 28, 13: 25, 17: 29 }));
  assert.equal(mm.notice.lost, 1);
  assert.equal(Object.keys(mm.grades).length, 2);
  assert.equal(rowName("master", "MM", Object.keys(mm.grades)[0]), "Market research and business forecasting");

  // Plan renamed: BEMACC becomes CLEACC-ENG, DSBA becomes DSBA-BA.
  assert.equal(load("bachelor", v1("BEMACC", {})).plan, "CLEACC-ENG");
  assert.equal(load("master", v1("DSBA", { 4: 28 })).plan, "DSBA-BA");
  assert.equal(
    rowName("master", "DSBA-BA", Object.keys(load("master", v1("DSBA", { 4: 28 })).grades)[0]),
    "Statistics and probability",
  );
});

test("migration keeps custom exams, settings, pass/fail marks and removed rows (by new id)", () => {
  const raw = v1("CLEAM", { 0: 27, c123: 29 }, {
    noGrade: ["8"],
    removed: ["3"],
    credits: { c123: 9 },
    custom: [{ id: "c123", name: "Extra", credits: 9, year: 2 }],
    settings: { internship: true, thesis: 3.5, bonus: true, thesisType: "research", onTime: false, athlete: false, target: 105 },
    direct: { on: true, average: "27,4" },
  });
  const s = load("bachelor", raw);
  assert.equal(s.grades.c123, 29);
  assert.equal(s.credits.c123, 9);
  assert.deepEqual(s.custom, [{ id: "c123", name: "Extra", credits: 9, year: 2 }]);
  assert.equal(s.settings.thesis, 3.5);
  assert.equal(s.settings.target, 105);
  assert.deepEqual(s.direct, { on: true, average: "27,4" });
  assert.deepEqual(s.noGrade.map((id) => rowName("bachelor", "CLEAM", id)), ["@english"]);
  assert.deepEqual(s.removed.map((id) => rowName("bachelor", "CLEAM", id)), ["Seminario di Critical thinking"]);
  // the state is usable
  const state = toState("bachelor", s, source);
  assert.equal(weightedAverage(state).gradedCredits, 10 + 9);
});

test("v2 saves: unknown ids are dropped and counted, a stale internship flag is ignored", () => {
  const f = freshSave("master", "AI", source);
  const rows = GRADE_PLANS.master.AI;
  const raw = { ...f, grades: { [rows[1].id]: 28, "2.gone": 30, "7.nope": 25 }, settings: { ...f.settings, internship: true } };
  const s = load("master", raw);
  assert.deepEqual(Object.keys(s.grades), [rows[1].id]);
  assert.equal(s.notice.lost, 2);
  // no internship switch on an MSc plan, whatever the save says
  assert.equal(toState("master", s, source).internship, false);
});

test("a malformed save never throws and falls back to defaults", () => {
  assert.equal(load("bachelor", null), null);
  assert.equal(load("bachelor", "text"), null);
  assert.equal(load("bachelor", 5), null);
  assert.equal(load("bachelor", []), null);
  assert.equal(load("bachelor", {}), null);
  assert.equal(load("bachelor", { plan: 4 }), null);
  const junk = [
    { plan: "CLEAM" },
    { plan: "CLEAM", v: 2, grades: "x", noGrade: {}, credits: [], removed: 3, custom: "x", settings: 7 },
    { plan: "CLEAM", v: 2, grades: { "1.computer-science": "28", x: NaN, y: 99, z: 10 }, custom: [{}, null, { id: "c1" }, { id: "c2", name: "A", credits: -4, year: 99 }], settings: { thesis: "high", target: 500, thesisType: 5 } },
    { plan: "NOPE", v: 2, grades: { "1.a": 28 } },
  ];
  for (const raw of junk) {
    for (const type of ["bachelor", "master", "clmg"]) {
      const s = load(type, raw);
      assert.ok(s && s.v === 2);
      toState(type, s, source); // must not throw either
    }
  }
  const s = load("bachelor", junk[2]);
  assert.deepEqual(s.custom, [{ id: "c2", name: "A", credits: 1, year: 5 }]);
  assert.equal(s.settings.target, 111);
  assert.equal(s.settings.thesis, 3);
  assert.deepEqual(s.grades, {});
  // plan that doesn't exist: an empty plan, not a crash (the screen offers the picker)
  assert.equal(toState("bachelor", load("bachelor", junk[3]), source).rows.length, 0);
});

test("random garbage never throws", () => {
  let seed = 5;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const val = (d = 0) =>
    pick([null, undefined, 1, -1, 1e9, NaN, "x", "", true, [], {}, () => d < 3 && [val(d + 1)], () => d < 3 && { a: val(d + 1), plan: "CLEAM" }].map((v) => (typeof v === "function" ? v() : v)));
  for (let i = 0; i < 2000; i++) {
    const raw = { plan: pick(["CLEAM", "MM", "X", 3]), v: pick([1, 2, undefined, "2"]), grades: val(), noGrade: val(), credits: val(), removed: val(), custom: val(), settings: val(), direct: val(), notice: val() };
    for (const type of ["bachelor", "master", "clmg"]) {
      const s = load(type, raw);
      if (s) toState(type, s, source);
    }
  }
});

test("switching plan: grades carry over within a programme, settings and own exams always", () => {
  const base = freshSave("bachelor", "BIEF-ECON", source);
  const rows = GRADE_PLANS.bachelor["BIEF-ECON"];
  const finRows = new Set(GRADE_PLANS.bachelor["BIEF-FIN"].map((r) => r.id));
  const shared = rows.find((r) => finRows.has(r.id) && r.k === "g");
  const only = rows.find((r) => !finRows.has(r.id) && r.k === "g");
  assert.ok(shared && only, "BIEF tracks share some exams and differ in others");
  const saved = {
    ...base,
    grades: { [shared.id]: 28, [only.id]: 30, c1: 27 },
    custom: [{ id: "c1", name: "Mine", credits: 6, year: 2 }],
    settings: { ...base.settings, thesis: 3.5, target: 108 },
  };
  const sw = switchPlan("bachelor", saved, "BIEF-FIN", source);
  assert.equal(sw.saved.plan, "BIEF-FIN");
  assert.equal(sw.saved.grades[shared.id], 28);
  assert.equal(sw.saved.grades[only.id], undefined);
  assert.equal(sw.saved.grades.c1, 27);
  assert.equal(sw.keptGrades, 1);
  assert.equal(sw.lostGrades, 1);
  assert.equal(sw.customKept, 1);
  assert.equal(sw.saved.settings.thesis, 3.5);
  assert.equal(sw.saved.settings.target, 108);

  // Another programme: no plan grade carries over (same-named exams are not assumed to be the same course).
  const other = switchPlan("bachelor", saved, "CLEAM", source);
  assert.deepEqual(Object.keys(other.saved.grades), ["c1"]);
  assert.equal(other.keptGrades, 0);
  assert.equal(other.lostGrades, 2);
  assert.equal(other.saved.custom.length, 1);
  assert.equal(other.saved.settings.thesis, 3.5);
});

test("switching plan resets the internship switch to the new plan's", () => {
  const saved = { ...freshSave("bachelor", "BGL-GL", source) };
  assert.equal(saved.settings.internship, true); // BGL-GL lists an internship-or-clinic row
  const sw = switchPlan("bachelor", saved, "CLEAM", source);
  assert.equal(sw.saved.settings.internship, false);
});
