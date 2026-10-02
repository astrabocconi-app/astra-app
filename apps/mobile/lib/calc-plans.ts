import { GRADE_PLANS, type CalcType, type AcademicProfile } from "@astra/shared";

// Picker labels for the calculator plans. Keys are GRADE_PLANS keys; anything
// missing here falls back to its key.
export const PLAN_NAMES: Record<string, string> = {
  CLEAM: "CLEAM · Economia aziendale e management",
  CLEF: "CLEF · Economia e finanza",
  BESS: "BESS · Economic and Social Sciences",
  BEMACS: "BEMACS · Economics, Management and Computer Science",
  BIEM: "BIEM · International Economics and Management",
  "BIEF-ECON": "BIEF · Economics",
  "BIEF-FIN": "BIEF · Finance",
  CLEACC: "CLEACC · Classe italiana",
  "CLEACC-ENG": "CLEACC · English class",
  BEMACC: "BEMACC · Arts, Culture and Communication",
  BIG: "BIG · Politics and Policy Making",
  "BIG-DSO": "BIG · Data, Society and Organisation (HEC)",
  BAI: "BAI · Mathematical and Computing Sciences for AI",
  "BGL-GL": "BGL · Global Law",
  "BGL-DL": "BGL · Domestic Lawyer",
  ACME: "ACME · Arts, Culture, Media and Entertainment",
  AFM: "AFM · Accounting and Financial Management",
  AI: "AI · Artificial Intelligence",
  CLELI: "CLELI · Economia e legislazione per l'impresa",
  CRSG: "Cyber Risk Strategy and Governance",
  DAAIHS: "DAIHS · Data Analytics and AI in Health Sciences",
  DSBA: "DSBA · Data Science and Business Analytics",
  EMIT: "EMIT · Innovation and Technology",
  ESS: "ESS · Economic and Social Sciences",
  FINANCE: "Finance",
  GIO: "GIO · Government and International Organizations",
  IM: "IM · International Management",
  "IM-CONCENTRATION": "IM · Concentrations",
  "IM-GLOBAL": "IM · Global Experience",
  MM: "Marketing Management",
  PPA: "PPA · Politics and Policy Analysis",
  TS: "Transformative Sustainability",
  CLMG: "CLMG · Giurisprudenza",
};

// Catalogue programme codes that differ from the plan keys.
const ALIASES: Record<string, string> = {
  FIN: "FINANCE",
  "CLEFIN-FINANCE": "FINANCE",
  DAIHS: "DAAIHS",
  CYBER: "CRSG",
  M: "MM",
};

export function plansFor(type: CalcType): string[] {
  return Object.keys(GRADE_PLANS[type]).sort((a, b) => (PLAN_NAMES[a] ?? a).localeCompare(PLAN_NAMES[b] ?? b));
}

export function typeForLevel(level: string | undefined): CalcType {
  if (level === "MASTER_OF_SCIENCE") return "master";
  if (level === "INTEGRATED_MASTER") return "clmg";
  return "bachelor";
}

/** The plan that matches the student's saved programme and track, if any. */
export function defaultPlan(type: CalcType, academic: AcademicProfile | null): string {
  const keys = Object.keys(GRADE_PLANS[type]);
  const code = academic?.programme.code;
  if (code) {
    const candidates = [academic?.track?.code, ALIASES[code], code].filter(Boolean) as string[];
    for (const c of candidates) if (keys.includes(c)) return c;
    const prefixed = keys.find((k) => k.startsWith(`${code}-`));
    if (prefixed) return prefixed;
  }
  return plansFor(type)[0]!;
}
