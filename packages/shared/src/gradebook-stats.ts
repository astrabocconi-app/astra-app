// Gradebook maths. Pure functions over the records the API already returns —
// no fetching, no Prisma, no React — so mobile and web compute the same numbers
// from the same code instead of each rolling their own.
//
// These are the student's own figures, not an official transcript: Bocconi is
// the authority on what any of this actually says.

import type { ExamRecord } from "./schemas";

/** `30 e lode` is worth 31 in the weighted average. */
export const LODE_GRADE = 31;

/** Only these fields matter here; anything shaped like this can be measured. */
type Measurable = Pick<
  ExamRecord,
  "status" | "credits" | "grade" | "lode" | "passFail" | "examDate"
>;

/** A passed exam that carries a grade — the only kind the average is built on. */
function gradeOf(record: Measurable): number | null {
  if (record.status !== "PASSED" || record.passFail || record.grade == null) return null;
  return record.lode ? LODE_GRADE : record.grade;
}

/** Weighted average rounded to two decimals, or null when nothing is graded. */
function average(points: number, credits: number): number | null {
  return credits > 0 ? Math.round((points / credits) * 100) / 100 : null;
}

export function gradebookStats(records: readonly Measurable[]) {
  let points = 0;
  let gradedCredits = 0;
  let earnedCredits = 0;
  let plannedCredits = 0;
  let passedCount = 0;
  let plannedCount = 0;

  for (const record of records) {
    if (record.status === "PLANNED") {
      plannedCredits += record.credits;
      plannedCount += 1;
      continue;
    }
    passedCount += 1;
    earnedCredits += record.credits;

    const grade = gradeOf(record);
    if (grade != null) {
      points += grade * record.credits;
      gradedCredits += record.credits;
    }
  }

  return {
    weightedAverage: average(points, gradedCredits),
    /** Credits behind the average — pass/fail passes are not in here. */
    gradedCredits,
    /** Credits actually earned towards the degree, graded or not. */
    earnedCredits,
    plannedCredits,
    passedCount,
    plannedCount,
  };
}

/**
 * The running weighted average after each graded exam, oldest first — what the
 * average looked like on the day of each result. Undated exams are left out:
 * they count in the totals, they just can't be placed on a timeline.
 */
export function averageTrend(records: readonly Measurable[]) {
  const graded = records
    .filter((record) => record.examDate != null && gradeOf(record) != null)
    .sort((a, b) => a.examDate!.localeCompare(b.examDate!));

  let points = 0;
  let credits = 0;

  return graded.map((record) => {
    points += gradeOf(record)! * record.credits;
    credits += record.credits;
    return { date: record.examDate!, average: average(points, credits)! };
  });
}
