// MSc admission score and where it sits against what past admits reported. Pure.
//
// Bocconi ranks applicants on: weighted GPA (/30), plus — for "in corso"
// students only — 1 point and 0.05 per credit above the minimum needed to
// apply (90 in the first round, 110 in the second), those points being out of
// 110. Survey scores are on the same /30 scale, so we compare like with like.
// The data is passed in (see master-admissions-data.ts) to keep this testable.
//
// What the data can and can't say: it holds only people who were admitted, a
// handful per programme, from two different cycles, self-reported. So nothing
// here is a probability. A score above the lowest admit we know of is "above",
// not "likely"; a programme with few answers says so.

export type AdmissionRound = 1 | 2;

export interface MasterProgramme {
  key: string;
  name: string;
  /** Needs a motivation letter / CV / interview on top of the score. */
  selective?: boolean;
}

export const MASTER_PROGRAMMES: MasterProgramme[] = [
  { key: "AFM", name: "Accounting and Financial Management" },
  { key: "AI", name: "Artificial Intelligence", selective: true },
  { key: "CYBER", name: "Cyber Risk Strategy and Governance", selective: true },
  { key: "DSBA", name: "Data Science and Business Analytics" },
  { key: "ESS", name: "Economic and Social Sciences" },
  // Renamed INTENT in the 2026-27 regulation; the surveys call it EMIT/INTENT.
  { key: "EMIT", name: "EMIT / INTENT · Innovation, Technology and Entrepreneurship" },
  { key: "ACME", name: "Arts, Culture, Media and Entertainment" },
  { key: "GIO", name: "Government and International Organizations" },
  { key: "FIN", name: "Finance" },
  { key: "FIN-GLOB", name: "Finance · Global Experience", selective: true },
  { key: "CHINA-MIM", name: "IM Asia · China MIM", selective: true },
  { key: "ESSEC", name: "IM Asia · ESSEC", selective: true },
  { key: "IM-CEMS", name: "IM · CEMS MIM double degree", selective: true },
  { key: "IM-CONC", name: "IM · Concentrations" },
  { key: "IM-GLOB", name: "IM · Global Experience", selective: true },
  { key: "MM", name: "Marketing Management" },
  { key: "PPA", name: "Politics and Policy Analysis" },
  { key: "TS", name: "Transformative Sustainability", selective: true },
];

/** Credits needed to apply in each round; extra credits above it earn points. */
export const MIN_CREDITS: Record<AdmissionRound, number> = { 1: 90, 2: 110 };
/** The most credits a bachelor can have recorded; anything above is a typo. */
export const MAX_CREDITS = 200;

/** Points out of 110 on top of the GPA (in corso only). */
export function admissionBonus(credits: number, inCorso: boolean, round: AdmissionRound): number {
  if (!inCorso) return 0;
  return 1 + 0.05 * Math.max(0, credits - MIN_CREDITS[round]);
}

/** The ranking score on the /30 scale the surveys use. */
export function admissionScore(gpa: number, credits: number, inCorso: boolean, round: AdmissionRound): number {
  return gpa + (admissionBonus(credits, inCorso, round) * 30) / 110;
}

/** "27,45" or "27.45" → 27.45; anything else → null. */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type AdmissionInputField = "gpa" | "credits";

export interface AdmissionInputs {
  gpa: string;
  credits: string;
  inCorso: boolean;
  round: AdmissionRound;
}

export interface ScoreResult {
  score: number | null;
  /** Typed, but not a valid value. */
  error: AdmissionInputField | null;
  /** Not typed yet (and needed). */
  missing: AdmissionInputField | null;
}

/**
 * The score for what a student typed, or what is wrong with it. Credits only
 * matter for an on-track student (they are the bonus), and then they are
 * required: a blank must not quietly mean "the minimum".
 */
export function scoreForInputs(inputs: AdmissionInputs): ScoreResult {
  const none = { score: null, error: null, missing: null };
  const gpa = parseDecimal(inputs.gpa);
  if (gpa == null || gpa < 18 || gpa > 31) {
    return inputs.gpa.trim() === "" ? { ...none, missing: "gpa" } : { ...none, error: "gpa" };
  }
  if (!inputs.inCorso) return { ...none, score: admissionScore(gpa, 0, false, inputs.round) };
  const credits = parseDecimal(inputs.credits);
  if (credits == null || !Number.isInteger(credits) || credits < MIN_CREDITS[inputs.round] || credits > MAX_CREDITS) {
    return inputs.credits.trim() === "" ? { ...none, missing: "credits" } : { ...none, error: "credits" };
  }
  return { ...none, score: admissionScore(gpa, credits, true, inputs.round) };
}

/** Where a score sits against the lowest admit we know of. */
export type Standing = "above" | "close" | "below" | "none";

/** Within this many points under the lowest admit counts as "close". */
export const CLOSE_MARGIN = 0.5;
/** Fewer admits than this and the numbers say little: flagged, and no median. */
export const MIN_ADMITS_FOR_MEDIAN = 5;

export interface ProgrammeOutlook {
  programme: MasterProgramme;
  standing: Standing;
  /** Lowest score any respondent reported getting in with, this round. */
  lowest: number | null;
  /** Middle score of the admits we have; only with enough of them. */
  median: number | null;
  /** How many admits stand behind the numbers. */
  admits: number;
  /** Too few admits to lean on. */
  lowData: boolean;
  /** score − lowest */
  margin: number | null;
}

export interface AdmissionData {
  cycles?: { astra: string; blab: string };
  /** ASTRA's survey: first-round admits' scores per programme. */
  astra: Record<string, number[]>;
  blab: {
    /** B.lab's survey: first-round admits' scores per programme. */
    round1: Record<string, number[]>;
    /** One respondent per programme in the second round. */
    round2: Record<string, number[]>;
  };
}

/** The true median: the middle value, or the mean of the two in the middle. */
export function median(sorted: number[]): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  return n % 2 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

export function standing(score: number, lowest: number | null): Standing {
  if (lowest == null) return "none";
  const margin = score - lowest;
  // The margin is a difference of two-decimal numbers: compare in hundredths.
  const cents = Math.round(margin * 100);
  return cents >= 0 ? "above" : cents >= -CLOSE_MARGIN * 100 ? "close" : "below";
}

const ORDER: Record<Standing, number> = { above: 0, close: 1, below: 2, none: 3 };

export function outlook(score: number, round: AdmissionRound, data: AdmissionData): ProgrammeOutlook[] {
  return MASTER_PROGRAMMES.map((programme) => {
    const admits = (
      round === 1
        ? [...(data.astra[programme.key] ?? []), ...(data.blab.round1[programme.key] ?? [])]
        : [...(data.blab.round2[programme.key] ?? [])]
    ).sort((a, b) => a - b);
    const lowest = admits.length ? admits[0]! : null;
    const enough = admits.length >= MIN_ADMITS_FOR_MEDIAN;
    return {
      programme,
      standing: standing(score, lowest),
      lowest,
      median: enough ? median(admits) : null,
      admits: admits.length,
      lowData: admits.length < MIN_ADMITS_FOR_MEDIAN,
      margin: lowest == null ? null : score - lowest,
    };
  }).sort((a, b) => ORDER[a.standing] - ORDER[b.standing] || (b.margin ?? -99) - (a.margin ?? -99));
}
