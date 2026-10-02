// MSc admission score and how it compares with last cycle's admits. Pure.
//
// Bocconi ranks applicants on: weighted GPA (/30), plus — for "in corso"
// students only — 1 point and 0.05 per credit above the minimum needed to
// apply (90 in the first round, 110 in the second), those points being out of
// 110. Survey scores are on the same /30 scale, so we compare like with like.
// The data is passed in (see master-admissions-data.ts) to keep this testable.

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
  { key: "ESS", name: "Economics and Social Sciences" },
  { key: "EMIT", name: "Economics and Management of Innovation and Technology" },
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

/** Points out of 110 on top of the GPA (in corso only). */
export function admissionBonus(credits: number, inCorso: boolean, round: AdmissionRound): number {
  if (!inCorso) return 0;
  return 1 + 0.05 * Math.max(0, credits - MIN_CREDITS[round]);
}

/** The ranking score on the /30 scale the surveys use. */
export function admissionScore(gpa: number, credits: number, inCorso: boolean, round: AdmissionRound): number {
  return gpa + (admissionBonus(credits, inCorso, round) * 30) / 110;
}

export type Chance = "likely" | "possible" | "unlikely" | "unknown";

export interface ProgrammeOutlook {
  programme: MasterProgramme;
  chance: Chance;
  /** Lowest score anyone reported getting in with, this round. */
  lowest: number | null;
  /** Middle score of the admits we have (first round only). */
  median: number | null;
  /** Admits in ASTRA's survey behind the median (first round only). */
  respondents: number;
  /** score − lowest */
  margin: number | null;
}

export interface AdmissionData {
  survey: Record<string, number[]>;
  lowerBounds: { round1: Record<string, number>; round2: Record<string, number> };
}

// The second round has only lower bounds, so "likely" means a clear margin.
const ROUND2_MARGIN = 0.5;

export function outlook(score: number, round: AdmissionRound, data: AdmissionData): ProgrammeOutlook[] {
  const order: Record<Chance, number> = { likely: 0, possible: 1, unlikely: 2, unknown: 3 };
  return MASTER_PROGRAMMES.map((programme) => {
    const admits = round === 1 ? (data.survey[programme.key] ?? []) : [];
    const bound = (round === 1 ? data.lowerBounds.round1 : data.lowerBounds.round2)[programme.key];
    const candidates = [bound, admits[0]].filter((n): n is number => typeof n === "number");
    const lowest = candidates.length ? Math.min(...candidates) : null;
    const median = admits.length >= 3 ? admits[Math.floor(admits.length / 2)]! : null;
    let chance: Chance = "unknown";
    if (lowest != null) {
      const likelyFrom = median ?? lowest + ROUND2_MARGIN;
      chance = score >= likelyFrom ? "likely" : score >= lowest ? "possible" : "unlikely";
    }
    return {
      programme,
      chance,
      lowest,
      median,
      respondents: admits.length,
      margin: lowest == null ? null : score - lowest,
    };
  }).sort((a, b) => order[a.chance] - order[b.chance] || (b.margin ?? -99) - (a.margin ?? -99));
}
