// Bocconi graduation-grade maths for the calculators. Pure functions.
//
// Rules (Bocconi regulations 2025-26 / 2026-27):
//   average  credit-weighted over graded exams; 30 e lode counts as 31;
//            pass/fail items (seminars, internship) are left out. An exam split
//            into modules gets one grade: the modules' weighted mean, rounded
//            half up (the bachelor guide says so; the MSc and CLMG regulations
//            are silent, so the same rule is applied to every pair of modules
//            named as such).
//   base     average / 30 × 110
//   bachelor + thesis 0–4 + 1 bonus (internship, exchange, joint programme,
//            legal clinic, student-athlete medal…)
//            lode: sum of the elements ≥ 111 and thesis ≥ 3
//   master   + thesis 0–8 (research) or 0–5 (applied) + 1 on time + 1 athlete,
//            all of it capped at 8 (the Italian text, which prevails, caps "il
//            punteggio massimo totale"; the English text names only thesis and
//            on-time points, so the stricter reading is the conservative one);
//            lode: total ≥ 111
//   clmg     + thesis 0–6 + 1 "excellent curriculum" (internship, moot court,
//            legal clinic, exchange, student-athlete medal), capped at 6;
//            lode: thesis + curriculum = 6 and total ≥ 111
// The regulations say nothing about rounding the total, so the grade is rounded
// half up (the usual practice, and the screen says so), but lode is judged on
// the UNROUNDED sum, because the text reads "the sum … is at least 111".
// Thesis points can be fractions: the regulations only say "from 0 to N".
//
// Sums are done in integers (half credits × grade) wherever the inputs allow it,
// so an exact .5 never falls on the wrong side of a float.

import type { PlanKind, PlanRow } from "./grade-plans";

export const MIN_GRADE = 18;
// 30 e lode counts as 31 in the average, so it is a grade a student can aim for.
export const MAX_GRADE = 31;
/** 31 = 30 e lode. */
export const LODE = 31;

/** An exact average: Σ(half credits × grade) / Σ half credits. */
export interface Ratio {
  num: number;
  den: number;
}

/** Floor division that stays exact for the integers used here. */
const floorDiv = (a: number, b: number) => Math.floor(a / b);
const halfCredits = (c: number) => Math.round(c * 2);

// ── What do I still need? ─────────────────────────────────────────────────
// "What do I still need?" — given the remaining exams and a pass/fail test for
// a set of grades, find the lowest grade that works if every exam gets it, mixed
// alternatives ("a 30 and a 28 work as well as two 29s"), and how many grade
// combinations reach the target.

export interface Remaining {
  id: string;
  credits: number;
}

export interface Mix {
  /** Grade per remaining exam, same order as the input. */
  grades: number[];
  high: number;
  low: number;
  /** How many exams sit at `high`; the rest are at `low`. */
  highCount: number;
}

export interface Combinations {
  reaching: number;
  total: number;
  /** Module rounding is ignored in the count, so it can be a few off. */
  approximate: boolean;
}

export interface Simulation {
  /** Weighted average needed on the remaining exams (above 31 = impossible). */
  neededAverage: number;
  /** Already reached whatever happens (every exam at 18 is enough). */
  alreadySafe: boolean;
  /** Out of reach even with 30 e lode everywhere. */
  impossible: boolean;
  /** Lowest single grade that works on every remaining exam, if any. */
  uniform: number | null;
  /** Mixed ways to get there, cheapest first. Plain 30s before any 30 e lode. */
  mixes: Mix[];
  /** Grade combinations (18–31 per exam, 31 = 30 e lode) that reach the target; null when too many exams are left to count. */
  combinations: Combinations | null;
}

/** Counting stops being instant (and meaningful) with this many exams left. */
const MAX_EXAMS_TO_COUNT = 24;
const MAX_MIXES_PER_HIGH = 6;

/**
 * @param remaining exams still to sit
 * @param neededPoints Σ credits × grade the remaining exams must reach (the plain, module-less view)
 * @param passes does this grade per remaining exam reach the target? Defaults to
 *   the plain weighted sum; planForTarget passes the real graduation maths so
 *   module rounding is respected.
 */
export function simulate(
  remaining: Remaining[],
  neededPoints: number,
  passes?: (grades: number[]) => boolean,
  approximate = false,
): Simulation {
  const credits = remaining.map((r) => r.credits);
  const totalCredits = credits.reduce((a, b) => a + b, 0);
  const neededAverage = totalCredits > 0 ? neededPoints / totalCredits : 0;
  const ok =
    passes ?? ((grades: number[]) => grades.reduce((n, g, i) => n + g * credits[i]!, 0) >= neededPoints - 1e-9);
  const all = (g: number) => remaining.map(() => g);

  const alreadySafe = ok(all(MIN_GRADE));
  const impossible = !ok(all(MAX_GRADE));
  let uniform: number | null = null;
  if (!impossible && remaining.length > 0) {
    for (let g = MIN_GRADE; g <= MAX_GRADE; g++) {
      if (ok(all(g))) {
        uniform = g;
        break;
      }
    }
  }

  const mixes: Mix[] = [];
  if (uniform !== null && !alreadySafe && remaining.length > 1) {
    // Biggest exams take the high grade first: that's the fewest exams at it.
    const order = credits.map((c, i) => [c, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
    const collect = (high: number) => {
      const found: Mix[] = [];
      for (let low = uniform! - 1; low >= MIN_GRADE && found.length < MAX_MIXES_PER_HIGH; low--) {
        let hit: Mix | null = null;
        for (let k = 1; k < remaining.length && !hit; k++) {
          const grades = all(low);
          for (const i of order.slice(0, k)) grades[i] = high;
          if (ok(grades)) hit = { grades, high, low, highCount: k };
        }
        // Even all-but-one exam at `high` falls short here, and every lower
        // `low` falls shorter still.
        if (!hit) break;
        found.push(hit);
      }
      return found;
    };
    // A plain 30 is something a student can plan for; 30 e lode is the
    // examiner's gift. Only offer lode mixes when no plain one exists.
    for (let high = Math.min(30, MAX_GRADE); high > uniform; high--) mixes.push(...collect(high));
    if (mixes.length === 0 && uniform < MAX_GRADE) mixes.push(...collect(MAX_GRADE));
    // Most interesting first: fewest exams needing the high grade, then the
    // smallest gap between high and low.
    mixes.sort((a, b) => a.highCount - b.highCount || a.high - a.low - (b.high - b.low) || b.high - a.high);
  }

  return {
    neededAverage,
    alreadySafe,
    impossible,
    uniform,
    mixes: mixes.slice(0, 3),
    combinations:
      remaining.length > MAX_EXAMS_TO_COUNT ? null : { ...countCombinations(credits, neededPoints), approximate },
  };
}

/**
 * Count grade vectors (one grade 18–31 per exam) whose weighted sum reaches
 * `neededPoints`. Credits can be fractional (7.5), so sums are kept in half
 * credits. A dynamic programme over the running sum, which stops growing once
 * it has reached the target: exact, and fast for the dozen-or-so exams a
 * student has left. Counts are floats past 2^53, which is fine for display.
 */
export function countCombinations(credits: number[], neededPoints: number) {
  const units = credits.map(halfCredits);
  const target = Math.max(0, Math.ceil(neededPoints * 2 - 1e-9));
  const grades = MAX_GRADE - MIN_GRADE + 1;
  let dist = new Float64Array(target + 1);
  dist[0] = 1;
  for (const u of units) {
    const next = new Float64Array(target + 1);
    for (let sum = 0; sum <= target; sum++) {
      const ways = dist[sum]!;
      if (ways === 0) continue;
      for (let g = MIN_GRADE; g <= MAX_GRADE; g++) {
        const s = Math.min(target, sum + g * u);
        next[s] = next[s]! + ways;
      }
    }
    dist = next;
  }
  const total = grades ** units.length;
  return { reaching: dist[target]!, total };
}

// ── Graduation grade ──────────────────────────────────────────────────────

export type CalcType = "bachelor" | "master" | "clmg";

export interface CalcRow {
  id: string;
  name: string;
  credits: number;
  year: number;
  kind: PlanKind;
  module?: string;
  grade: number | null;
  /** The student marked it pass/fail (e.g. a language certification). */
  noGrade?: boolean;
}

export interface CalcState {
  type: CalcType;
  plan: string;
  rows: CalcRow[];
  /** The student does (did) a curricular internship (bachelor plans whose internship can replace an optional). */
  internship: boolean;
  /** Final paper points the student expects, in steps of 0.5. */
  thesis: number;
  /** Bachelor: +1 bonus. CLMG: +1 excellent curriculum. */
  bonus: boolean;
  thesisType: "research" | "applied";
  onTime: boolean;
  athlete: boolean;
  /** Target graduation grade; 111 = 110 e lode. */
  target: number;
}

export function rowsFromPlan(plan: PlanRow[]): CalcRow[] {
  return plan.map((r) => ({
    id: r.id,
    name: r.n,
    credits: r.c,
    year: r.y,
    kind: r.k,
    module: r.m,
    grade: null,
  }));
}

export function newState(type: CalcType, plan: string, rows: PlanRow[]): CalcState {
  return {
    type,
    plan,
    rows: rowsFromPlan(rows),
    // Only a plan that lists an internship an optional can replace has the switch.
    internship: rows.some((r) => r.k === "i"),
    thesis: type === "bachelor" ? 3 : type === "clmg" ? 4 : 5,
    bonus: false,
    thesisType: "research",
    onTime: false,
    athlete: false,
    target: 110,
  };
}

/** The optional slot an internship replaces: the last one that allows it. */
export function internshipSlotId(state: CalcState): string | null {
  const slots = state.rows.filter((r) => r.kind === "s");
  return slots.length ? slots[slots.length - 1]!.id : null;
}

/** Does this row get a grade that counts towards the average? */
export function isGraded(row: CalcRow, state: CalcState): boolean {
  if (row.noGrade || row.credits <= 0) return false;
  if (row.kind === "p") return false;
  if (row.kind === "i") return !state.internship;
  if (row.kind === "s") return !(state.internship && row.id === internshipSlotId(state));
  return true;
}

export interface Average {
  /** Weighted average of the grades entered so far (null: none yet). */
  average: number | null;
  /** The same average as an exact fraction, for rounding without float error. */
  ratio: Ratio | null;
  gradedCredits: number;
  /** Credits of every exam that will get a grade, entered or not. */
  totalCredits: number;
  remaining: CalcRow[];
  lodeCount: number;
}

export interface AverageOptions {
  /**
   * Count the modules of an integrated exam one by one instead of rounding
   * their mean. Master admissions rank on modules individually.
   */
  modulesIndividually?: boolean;
}

export function weightedAverage(state: CalcState, options: AverageOptions = {}): Average {
  const graded = state.rows.filter((r) => isGraded(r, state));
  const done = graded.filter((r) => r.grade != null);

  // A module counts once its exam is complete: rounded mean, total credits.
  const items: { credits: number; grade: number }[] = [];
  const byModule = new Map<string, CalcRow[]>();
  for (const r of done) {
    if (!r.module || options.modulesIndividually) {
      items.push({ credits: halfCredits(r.credits), grade: r.grade! });
      continue;
    }
    if (!byModule.has(r.module)) byModule.set(r.module, []);
    byModule.get(r.module)!.push(r);
  }
  for (const [module, rows] of byModule) {
    const all = graded.filter((r) => r.module === module);
    if (rows.length === all.length) {
      const credits = rows.reduce((n, r) => n + halfCredits(r.credits), 0);
      const points = rows.reduce((n, r) => n + halfCredits(r.credits) * r.grade!, 0);
      // Half up, in integers: (2·points + credits) / (2·credits).
      items.push({ credits, grade: floorDiv(2 * points + credits, 2 * credits) });
    } else {
      for (const r of rows) items.push({ credits: halfCredits(r.credits), grade: r.grade! });
    }
  }

  const den = items.reduce((n, i) => n + i.credits, 0);
  const num = items.reduce((n, i) => n + i.credits * i.grade, 0);
  return {
    average: den ? num / den : null,
    ratio: den ? { num, den } : null,
    gradedCredits: den / 2,
    totalCredits: graded.reduce((n, r) => n + r.credits, 0),
    remaining: graded.filter((r) => r.grade == null),
    lodeCount: done.filter((r) => r.grade === LODE).length,
  };
}

/** Step the thesis points move in. */
export const THESIS_STEP = 0.5;

export function thesisMax(state: CalcState): number {
  if (state.type === "bachelor") return 4;
  if (state.type === "clmg") return 6;
  return state.thesisType === "research" ? 8 : 5;
}

/** Points added on top of the average converted to /110. */
export function extraPoints(state: CalcState): number {
  const thesis = Math.min(Math.max(state.thesis, 0), thesisMax(state));
  if (state.type === "bachelor") return thesis + (state.bonus ? 1 : 0);
  if (state.type === "clmg") return Math.min(thesis + (state.bonus ? 1 : 0), 6);
  return Math.min(thesis + (state.onTime ? 1 : 0) + (state.athlete ? 1 : 0), 8);
}

export interface Graduation {
  /** average / 30 × 110 */
  base: number;
  extras: number;
  /** base + extras, unrounded. */
  total: number;
  /** What the transcript would say: rounded half up, capped at 110. */
  grade: number;
  /** The same, before the cap at 110. */
  rounded: number;
  /** The board may award lode. */
  lodePossible: boolean;
}

/**
 * @param average a plain number (a typed-in average) or the exact ratio from
 *   weightedAverage; typed averages are taken to four decimals.
 */
export function graduation(state: CalcState, average: number | Ratio): Graduation {
  const ratio: Ratio =
    typeof average === "number" ? { num: Math.round(average * 10000), den: 10000 } : average;
  const extras = extraPoints(state);
  const extras2 = Math.round(extras * 2);
  // total = 11·num / (3·den) + extras2 / 2 = (22·num + 3·den·extras2) / (6·den)
  const top = 22 * ratio.num + 3 * ratio.den * extras2;
  const bottom = 6 * ratio.den;
  const rounded = floorDiv(top + bottom / 2, bottom);
  const base = (ratio.num / ratio.den / 30) * 110;
  // "The sum of the elements is at least 111": compared before rounding.
  let lodePossible = top >= 111 * bottom;
  if (state.type === "bachelor") lodePossible &&= Math.min(state.thesis, thesisMax(state)) >= 3;
  if (state.type === "clmg") lodePossible &&= extras >= 6;
  return { base, extras, total: top / bottom, grade: Math.min(rounded, 110), rounded, lodePossible };
}

export interface TargetPlan extends Simulation {
  /** No exams left to sit: the grade is already decided by the inputs. */
  noneLeft: boolean;
  /** With no exams left: does the grade reach the target? (null: nothing graded at all) */
  met: boolean | null;
  /** Aiming for 110 e lode with a final paper that can't earn it. */
  lodeBlocked: boolean;
  /** Weighted average needed over the whole degree. */
  overallAverage: number;
}

/** The state with a grade on each exam still open, in `remaining` order. */
function withGrades(state: CalcState, open: CalcRow[], grades: number[]): CalcState {
  const byId = new Map(open.map((r, i) => [r.id, grades[i]!]));
  return { ...state, rows: state.rows.map((r) => (byId.has(r.id) ? { ...r, grade: byId.get(r.id)! } : r)) };
}

/** Does this state's final grade reach its target? Same maths the graduation panel shows. */
export function reachesTarget(state: CalcState): boolean | null {
  const avg = weightedAverage(state);
  if (!avg.ratio) return null;
  const g = graduation(state, avg.ratio);
  return state.target >= 111 ? g.lodePossible : g.rounded >= state.target;
}

/** What the remaining exams need for `state.target` (111 = 110 e lode). */
export function planForTarget(state: CalcState): TargetPlan {
  const avg = weightedAverage(state);
  const lode = state.target >= 111;
  // The total only has to reach target − 0.5 once rounded half up; lode needs the full 111.
  const overallAverage = (((lode ? 111 : state.target - 0.5) - extraPoints(state)) * 30) / 110;
  const entered = state.rows
    .filter((r) => isGraded(r, state) && r.grade != null)
    .reduce((n, r) => n + r.credits * r.grade!, 0);
  const neededPoints = overallAverage * avg.totalCredits - entered;
  const open = avg.remaining;
  // A module is only rounded once all its exams are in, so the plan can't just
  // add up credits × grade: it asks the graduation maths itself.
  const touchesModule = open.some((r) => r.module);
  const lodeBlocked =
    lode &&
    ((state.type === "bachelor" && Math.min(state.thesis, thesisMax(state)) < 3) || (state.type === "clmg" && extraPoints(state) < 6));
  const passes = (grades: number[]) => !lodeBlocked && reachesTarget(withGrades(state, open, grades)) === true;
  const sim = simulate(
    open.map((r) => ({ id: r.id, credits: r.credits })),
    neededPoints,
    passes,
    touchesModule,
  );
  const noneLeft = open.length === 0;
  return {
    ...sim,
    noneLeft,
    met: noneLeft ? reachesTarget(state) : null,
    lodeBlocked,
    overallAverage,
  };
}

/** The average to feed master admissions: modules counted one by one. */
export function admissionAverage(state: CalcState): number | null {
  return weightedAverage(state, { modulesIndividually: true }).average;
}

// ── What a calculator saves ───────────────────────────────────────────────
// Kept here, away from the screen, so loading, migrating and switching plans
// can be tested. The plans (and the frozen map from old positions) are passed
// in as a PlanSource.

export interface PlanSource {
  rows: (type: CalcType, plan: string) => PlanRow[];
  /** Old plan key → current key, for plans that were renamed or merged. */
  legacyAliases?: Record<string, Record<string, string>>;
  /** Old plan key → ids by old position (null: that exam no longer exists). */
  legacyIds?: Record<string, Record<string, (string | null)[]>>;
}

/**
 * What a calculator saves: the chosen plan and only what the student changed.
 * Rows are rebuilt from the plan, so the value stays small and picks up plan
 * corrections in later releases. Grades are keyed by the plan rows' stable ids
 * (v2); releases 1.1.0-1.1.3 keyed them by position (no `v`) and are migrated
 * on load.
 */
export interface SavedCalc {
  v: 2;
  plan: string;
  grades: Record<string, number>;
  noGrade: string[];
  credits: Record<string, number>;
  removed: string[];
  custom: { id: string; name: string; credits: number; year: number }[];
  settings: Pick<CalcState, "internship" | "thesis" | "bonus" | "thesisType" | "onTime" | "athlete" | "target">;
  /**
   * Graduation grade from a typed-in average instead of the exam list, for
   * students who don't want to fill in every exam. Optional: saves from
   * before this existed don't have it.
   */
  direct?: { on: boolean; average: string };
  /** Grades that could not be carried over by the last migration; shown once, then cleared. */
  notice?: { lost: number };
}


export function freshSave(type: CalcType, plan: string, source: PlanSource): SavedCalc {
  const { internship, thesis, bonus, thesisType, onTime, athlete, target } = newState(type, plan, source.rows(type, plan));
  return {
    v: 2,
    plan,
    grades: {},
    noGrade: [],
    credits: {},
    removed: [],
    custom: [],
    settings: { internship, thesis, bonus, thesisType, onTime, athlete, target },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

/**
 * Turns whatever was stored into a SavedCalc, or null when it is not a
 * calculator save at all. Never throws: wrong-typed or missing pieces fall back
 * to their defaults, ids that match no exam of the plan are dropped (and
 * counted in `notice` so the student is told).
 */
export function loadSaved(type: CalcType, raw: unknown, source: PlanSource): SavedCalc | null {
  if (!isObj(raw) || typeof raw.plan !== "string") return null;
  const legacy = raw.v !== 2;
  const oldPlan = raw.plan;
  const plan = legacy ? (source.legacyAliases?.[type]?.[oldPlan] ?? oldPlan) : oldPlan;
  const rows = source.rows(type, plan);
  const known = new Set(rows.map((r) => r.id));
  const legacyIds = source.legacyIds?.[type]?.[oldPlan];
  const fresh = freshSave(type, plan, source);

  // The id a stored key stands for now, or null when it can't be matched.
  const mapId = (id: string): string | null => {
    if (id.startsWith("c")) return id; // custom exams are the student's own
    if (legacy) {
      const at = /^\d+$/.test(id) ? Number(id) : -1;
      return legacyIds?.[at] ?? null;
    }
    return known.has(id) ? id : null;
  };

  let lost = 0;
  const grades: Record<string, number> = {};
  if (isObj(raw.grades)) {
    for (const [id, g] of Object.entries(raw.grades)) {
      if (!num(g) || g < 18 || g > 31) continue;
      const to = mapId(id);
      if (to && !(to in grades)) grades[to] = Math.round(g);
      else lost++;
    }
  }
  const credits: Record<string, number> = {};
  if (isObj(raw.credits)) {
    for (const [id, c] of Object.entries(raw.credits)) {
      const to = mapId(id);
      if (to && num(c) && c > 0 && c <= 60) credits[to] = c;
    }
  }
  const ids = (list: unknown) => [...new Set(strs(list).map(mapId).filter((x): x is string => !!x))];
  const custom = (Array.isArray(raw.custom) ? raw.custom : [])
    .filter(
      (c): c is { id: string; name: string; credits: number; year: number } =>
        isObj(c) && typeof c.id === "string" && c.id.startsWith("c") && typeof c.name === "string" && num(c.credits) && num(c.year),
    )
    .map((c) => ({
      id: c.id,
      name: c.name.slice(0, 80),
      credits: Math.min(Math.max(c.credits, 1), 30),
      year: Math.min(Math.max(Math.round(c.year), 1), 5),
    }));

  const s = isObj(raw.settings) ? raw.settings : {};
  const d = fresh.settings;
  const settings: SavedCalc["settings"] = {
    internship: typeof s.internship === "boolean" ? s.internship : d.internship,
    thesis: num(s.thesis) ? Math.min(Math.max(Math.round(s.thesis * 2) / 2, 0), 8) : d.thesis,
    bonus: typeof s.bonus === "boolean" ? s.bonus : d.bonus,
    thesisType: s.thesisType === "applied" ? "applied" : "research",
    onTime: typeof s.onTime === "boolean" ? s.onTime : d.onTime,
    athlete: typeof s.athlete === "boolean" ? s.athlete : d.athlete,
    target: num(s.target) ? Math.min(Math.max(Math.round(s.target), 66), 111) : d.target,
  };
  const out: SavedCalc = {
    v: 2,
    plan,
    grades,
    noGrade: ids(raw.noGrade),
    credits,
    removed: ids(raw.removed),
    custom,
    settings,
  };
  if (isObj(raw.direct) && typeof raw.direct.on === "boolean" && typeof raw.direct.average === "string") {
    out.direct = { on: raw.direct.on, average: raw.direct.average.slice(0, 6) };
  }
  const total = lost + (isObj(raw.notice) && num(raw.notice.lost) ? raw.notice.lost : 0);
  if (total > 0) out.notice = { lost: total };
  return out;
}

/** Does this plan have an internship switch (an optional that an internship replaces)? */
const hasSwitch = (rows: PlanRow[]) => rows.some((r) => r.k === "i" || r.k === "s");

export function toState(type: CalcType, saved: SavedCalc, source: PlanSource): CalcState {
  const rowsOfPlan = source.rows(type, saved.plan);
  const base = newState(type, saved.plan, rowsOfPlan);
  const custom: CalcRow[] = saved.custom.map((c) => ({ ...c, kind: "g", grade: null }));
  const rows = [...base.rows, ...custom]
    .filter((r) => !saved.removed.includes(r.id))
    .map((r) => ({
      ...r,
      credits: saved.credits[r.id] ?? r.credits,
      grade: saved.grades[r.id] ?? null,
      noGrade: saved.noGrade.includes(r.id),
    }));
  // The switch only exists on plans that have an internship slot; a stale flag from
  // an older plan version must not hide an optional course.
  const internship = hasSwitch(rowsOfPlan) && saved.settings.internship;
  return { ...base, ...saved.settings, internship, rows };
}

/** Plans of one programme (BIEF-ECON / BIEF-FIN, IM-GLOBAL / IM-CONCENTRATION…) share most exams. */
const family = (plan: string) => plan.split("-")[0];

export interface PlanSwitch {
  saved: SavedCalc;
  /** Grades that stay on the same exam in the new plan. */
  keptGrades: number;
  /** Grades that belong to exams the new plan doesn't have. */
  lostGrades: number;
  /** Pass/fail marks, changed credits and removed exams that are dropped with them. */
  lostMarks: number;
  /** Exams the student added, kept as they are. */
  customKept: number;
}

/**
 * Switching programme. Settings (final paper, bonuses, target), the typed-in
 * average and the student's own exams carry over; grades and marks carry over
 * only between plans of the same programme, for exams with the same id.
 */
export function switchPlan(type: CalcType, saved: SavedCalc, plan: string, source: PlanSource): PlanSwitch {
  const next = freshSave(type, plan, source);
  const known = new Set(source.rows(type, plan).map((r) => r.id));
  const same = family(saved.plan) === family(plan);
  const carry = <T>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).filter(([id]) => id.startsWith("c") || (same && known.has(id)))) as Record<string, T>;
  const keep = (list: string[]) => list.filter((id) => id.startsWith("c") || (same && known.has(id)));
  const grades = carry(saved.grades);
  const out: SavedCalc = {
    ...next,
    grades,
    noGrade: keep(saved.noGrade),
    credits: carry(saved.credits),
    removed: keep(saved.removed),
    custom: saved.custom,
    settings: { ...saved.settings, internship: next.settings.internship },
    direct: saved.direct,
  };
  const planGrades = Object.keys(saved.grades).filter((id) => !id.startsWith("c"));
  const kept = planGrades.filter((id) => id in grades).length;
  const marks =
    saved.noGrade.filter((id) => !id.startsWith("c")).length +
    saved.removed.length +
    Object.keys(saved.credits).filter((id) => !id.startsWith("c")).length;
  const keptMarks =
    out.noGrade.filter((id) => !id.startsWith("c")).length +
    out.removed.length +
    Object.keys(out.credits).filter((id) => !id.startsWith("c")).length;
  return {
    saved: out,
    keptGrades: kept,
    lostGrades: planGrades.length - kept,
    lostMarks: marks - keptMarks,
    customKept: saved.custom.length,
  };
}
