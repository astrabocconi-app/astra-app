// Bocconi graduation-grade maths for the calculators. Pure functions.
//
// Rules (Bocconi regulations 2025-26 / 2026-27):
//   average  credit-weighted over graded exams; 30 e lode counts as 31;
//            pass/fail items (seminars, internship) are left out. An exam split
//            into modules gets one grade: the modules' weighted mean, rounded.
//   base     average / 30 × 110
//   bachelor + thesis 0–4 + 1 bonus (internship, exchange, joint programme…)
//            lode: total ≥ 111 and thesis ≥ 3
//   master   + thesis 0–8 (research) or 0–5 (applied) + 1 on time + 1 athlete,
//            extras capped at 8; lode: total ≥ 111
//   clmg     + thesis 0–6 + 1 "excellent curriculum", capped at 6;
//            lode: thesis + curriculum = 6 and total ≥ 111
// The regulations don't say how the total is rounded; we round half up, the
// usual practice, and the screen says so.

import type { PlanKind, PlanRow } from "./grade-plans";

// ── What do I still need? ─────────────────────────────────────────────────
// "What do I still need?" — pure maths over the exams a student has left.
//
// Given the remaining exams (credits each) and how many weighted points they
// must add up to (Σ credits × grade), find: the average needed, the lowest
// grade that works if every exam gets it, mixed alternatives ("a 30 and a 28
// work as well as two 29s"), and how many grade combinations reach it.

export const MIN_GRADE = 18;
// 30 e lode counts as 31 in the average, so it is a grade a student can aim for.
export const MAX_GRADE = 31;

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

export interface Simulation {
  /** Weighted average needed on the remaining exams (above 31 = impossible). */
  neededAverage: number;
  /** Already reached whatever happens (every exam at 18 is enough). */
  alreadySafe: boolean;
  /** Out of reach even with 30 e lode everywhere. */
  impossible: boolean;
  /** Lowest single grade that works on every remaining exam, if any. */
  uniform: number | null;
  /** Mixed ways to get there, cheapest first. */
  mixes: Mix[];
  /** Grade combinations (18–31 per exam, 31 = 30 e lode) that reach the target, and the total. */
  combinations: { reaching: number; total: number };
}

/**
 * @param remaining exams still to sit
 * @param neededPoints Σ credits × grade the remaining exams must reach
 */
export function simulate(remaining: Remaining[], neededPoints: number): Simulation {
  const credits = remaining.map((r) => r.credits);
  const totalCredits = credits.reduce((a, b) => a + b, 0);
  const neededAverage = totalCredits > 0 ? neededPoints / totalCredits : 0;
  const alreadySafe = neededPoints <= MIN_GRADE * totalCredits;
  const impossible = neededPoints > MAX_GRADE * totalCredits + 1e-9;

  let uniform: number | null = null;
  if (!impossible && totalCredits > 0) {
    uniform = Math.max(MIN_GRADE, Math.ceil(neededAverage - 1e-9));
  }

  const mixes: Mix[] = [];
  if (uniform !== null && !alreadySafe && remaining.length > 1) {
    // Biggest exams take the high grade first: that's the fewest exams at it.
    const order = credits.map((c, i) => [c, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
    for (let high = MAX_GRADE; high > uniform; high--) {
      for (let low = uniform - 1; low >= MIN_GRADE && mixes.length < 6; low--) {
        let points = low * totalCredits;
        let highCount = 0;
        for (const i of order) {
          if (points >= neededPoints - 1e-9) break;
          points += (high - low) * credits[i]!;
          highCount++;
        }
        if (points < neededPoints - 1e-9 || highCount === remaining.length) break;
        const grades = credits.map(() => low);
        for (const i of order.slice(0, highCount)) grades[i] = high;
        mixes.push({ grades, high, low, highCount });
      }
    }
    // Most interesting first: fewest exams needing the high grade, then the
    // smallest gap between high and low.
    mixes.sort((a, b) => a.highCount - b.highCount || a.high - a.low - (b.high - b.low));
  }

  return {
    neededAverage,
    alreadySafe,
    impossible,
    uniform,
    mixes: mixes.slice(0, 3),
    combinations: countCombinations(credits, neededPoints),
  };
}

/**
 * Count grade vectors (one grade 18–31 per exam) whose weighted sum reaches
 * `neededPoints`. Credits can be fractional (7.5), so sums are kept in half
 * credits. A dynamic programme over the running sum: exact, and fast for the
 * dozen-or-so exams a student has left. Counts are floats past 2^53, which is
 * fine for display.
 */
export function countCombinations(credits: number[], neededPoints: number) {
  const units = credits.map((c) => Math.round(c * 2));
  const target = Math.ceil(neededPoints * 2 - 1e-9);
  let dist = new Map<number, number>([[0, 1]]);
  for (const u of units) {
    const next = new Map<number, number>();
    for (const [sum, ways] of dist) {
      for (let g = MIN_GRADE; g <= MAX_GRADE; g++) {
        const s = sum + g * u;
        next.set(s, (next.get(s) ?? 0) + ways);
      }
    }
    dist = next;
  }
  let reaching = 0;
  let total = 0;
  for (const [sum, ways] of dist) {
    total += ways;
    if (sum >= target) reaching += ways;
  }
  return { reaching, total };
}

// ── Graduation grade ──────────────────────────────────────────────────────

export type CalcType = "bachelor" | "master" | "clmg";

/** 31 = 30 e lode. */
export const LODE = 31;

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
  /** The student does (did) a curricular internship. */
  internship: boolean;
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
  return plan.map((r, i) => ({
    id: `${i}`,
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
    // An MSc plan lists the internship as such; a bachelor's is an option.
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
  gradedCredits: number;
  /** Credits of every exam that will get a grade, entered or not. */
  totalCredits: number;
  remaining: CalcRow[];
  lodeCount: number;
}

export function weightedAverage(state: CalcState): Average {
  const graded = state.rows.filter((r) => isGraded(r, state));
  const done = graded.filter((r) => r.grade != null);

  // A module counts once its exam is complete: rounded mean, total credits.
  const items: { credits: number; grade: number }[] = [];
  const byModule = new Map<string, CalcRow[]>();
  for (const r of done) {
    if (!r.module) {
      items.push({ credits: r.credits, grade: r.grade! });
      continue;
    }
    if (!byModule.has(r.module)) byModule.set(r.module, []);
    byModule.get(r.module)!.push(r);
  }
  for (const [module, rows] of byModule) {
    const all = graded.filter((r) => r.module === module);
    const credits = rows.reduce((n, r) => n + r.credits, 0);
    const mean = rows.reduce((n, r) => n + r.grade! * r.credits, 0) / credits;
    if (rows.length === all.length) items.push({ credits, grade: Math.round(mean) });
    else for (const r of rows) items.push({ credits: r.credits, grade: r.grade! });
  }

  const gradedCredits = items.reduce((n, i) => n + i.credits, 0);
  const points = items.reduce((n, i) => n + i.credits * i.grade, 0);
  return {
    average: gradedCredits ? points / gradedCredits : null,
    gradedCredits,
    totalCredits: graded.reduce((n, r) => n + r.credits, 0),
    remaining: graded.filter((r) => r.grade == null),
    lodeCount: done.filter((r) => r.grade === LODE).length,
  };
}

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
  /** What the transcript would say: rounded, capped at 110. */
  grade: number;
  /** The board may award lode. */
  lodePossible: boolean;
}

export function graduation(state: CalcState, average: number): Graduation {
  const base = (average / 30) * 110;
  const extras = extraPoints(state);
  const total = base + extras;
  const rounded = Math.round(total);
  let lodePossible = rounded >= 111;
  if (state.type === "bachelor") lodePossible &&= state.thesis >= 3;
  if (state.type === "clmg") lodePossible &&= extras >= 6;
  return { base, extras, total, grade: Math.min(rounded, 110), lodePossible };
}

export interface TargetPlan extends Simulation {
  /** No exams left to sit: the grade is already decided by the inputs. */
  noneLeft: boolean;
  /** Weighted average needed over the whole degree. */
  overallAverage: number;
}

/** What the remaining exams need for `state.target` (111 = 110 e lode). */
export function planForTarget(state: CalcState): TargetPlan {
  const avg = weightedAverage(state);
  // Rounded half up, so the total only has to reach target − 0.5.
  const overallAverage = ((state.target - 0.5 - extraPoints(state)) * 30) / 110;
  const entered = state.rows
    .filter((r) => isGraded(r, state) && r.grade != null)
    .reduce((n, r) => n + r.credits * r.grade!, 0);
  const neededPoints = overallAverage * avg.totalCredits - entered;
  const sim = simulate(
    avg.remaining.map((r) => ({ id: r.id, credits: r.credits })),
    neededPoints,
  );
  return { ...sim, noneLeft: avg.remaining.length === 0, overallAverage };
}
