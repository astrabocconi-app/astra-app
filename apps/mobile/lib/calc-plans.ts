import { GRADE_PLANS, PLAN_META, type CalcType, type AcademicProfile } from "@astra/shared";
import type { Language } from "./language-store";
import { pickPlan } from "./calc-plan-map";

// Picker labels for the calculator plans, in the app's language. Keys are
// GRADE_PLANS keys; a plan missing here shows its key.
const PLAN_NAMES: Record<string, { en: string; it: string }> = {
  CLEAM: { en: "CLEAM · Economics and Management (Italian)", it: "CLEAM · Economia aziendale e management" },
  CLEF: { en: "CLEF · Economics and Finance (Italian)", it: "CLEF · Economia e finanza" },
  BESS: { en: "BESS · Economic and Social Sciences", it: "BESS · Economic and Social Sciences" },
  BEMACS: {
    en: "BEMACS · Economics, Management and Computer Science",
    it: "BEMACS · Economics, Management and Computer Science",
  },
  BIEM: { en: "BIEM · International Economics and Management", it: "BIEM · International Economics and Management" },
  "BIEF-ECON": { en: "BIEF · Economics", it: "BIEF · Economics" },
  "BIEF-FIN": { en: "BIEF · Finance", it: "BIEF · Finance" },
  CLEACC: { en: "CLEACC · Italian class", it: "CLEACC · Classe italiana" },
  "CLEACC-ENG": { en: "CLEACC · English class (BEMACC)", it: "CLEACC · Classe inglese (BEMACC)" },
  BIG: { en: "BIG · Politics and Policy Making", it: "BIG · Politics and Policy Making" },
  "BIG-DSO": { en: "BIG · Data, Society and Organisation (HEC)", it: "BIG · Data, Society and Organisation (HEC)" },
  BAI: { en: "BAI · Mathematical and Computing Sciences for AI", it: "BAI · Mathematical and Computing Sciences for AI" },
  "BGL-GL": { en: "BGL · Global Law", it: "BGL · Global Law" },
  "BGL-DL": { en: "BGL · Domestic Lawyer", it: "BGL · Domestic Lawyer" },
  ACME: { en: "ACME · Arts, Culture, Media and Entertainment", it: "ACME · Arts, Culture, Media and Entertainment" },
  AFM: { en: "AFM · Accounting and Financial Management", it: "AFM · Accounting and Financial Management" },
  AI: { en: "AI · Artificial Intelligence", it: "AI · Artificial Intelligence" },
  CLELI: { en: "CLELI · Law and Economics for Business (Italian)", it: "CLELI · Economia e legislazione per l'impresa" },
  CRSG: { en: "CYBER · Cyber Risk Strategy and Governance", it: "CYBER · Cyber Risk Strategy and Governance" },
  DAAIHS: { en: "DAIHS · Data Analytics and AI in Health Sciences", it: "DAIHS · Data Analytics and AI in Health Sciences" },
  "DSBA-BA": { en: "DSBA · Business Analytics track", it: "DSBA · Percorso Business Analytics" },
  "DSBA-DS": { en: "DSBA · Data Science track", it: "DSBA · Percorso Data Science" },
  EMIT: { en: "EMIT · Innovation and Technology (until 2025-26)", it: "EMIT · Innovation and Technology (fino al 2025-26)" },
  INTENT: { en: "INTENT · Innovation, Technology and Entrepreneurship", it: "INTENT · Innovation, Technology and Entrepreneurship" },
  ESS: { en: "ESS · Economic and Social Sciences", it: "ESS · Economic and Social Sciences" },
  FINANCE: { en: "Finance", it: "Finance" },
  "FINANCE-GLOBAL": { en: "Finance · Global Experience", it: "Finance · Global Experience" },
  GIO: { en: "GIO · Government and International Organizations", it: "GIO · Government and International Organizations" },
  IM: { en: "IM · earlier plan", it: "IM · piano precedente" },
  "IM-CONCENTRATION": { en: "IM · Concentrations", it: "IM · Concentrations" },
  "IM-GLOBAL": { en: "IM · Global Experience", it: "IM · Global Experience" },
  MM: { en: "Marketing Management", it: "Marketing Management" },
  PPA: { en: "PPA · Politics and Policy Analysis", it: "PPA · Politics and Policy Analysis" },
  TS: { en: "Transformative Sustainability", it: "Transformative Sustainability" },
  CLMG: { en: "CLMG · Law (single-cycle)", it: "CLMG · Giurisprudenza" },
};

export function planName(plan: string, language: Language): string {
  return PLAN_NAMES[plan]?.[language] ?? plan;
}

/** "2025-26" for a plan, or null when the plan has no cohort (an older plan). */
export function planCohort(type: CalcType, plan: string): { cohort: string | null; legacy: boolean } {
  const meta = (PLAN_META[type] as Record<string, { cohort: string | null; legacy?: boolean }>)[plan];
  return { cohort: meta?.cohort ?? null, legacy: !!meta?.legacy };
}

export function plansFor(type: CalcType, language: Language = "en"): string[] {
  return Object.keys(GRADE_PLANS[type]).sort((a, b) => planName(a, language).localeCompare(planName(b, language)));
}

export function typeForLevel(level: string | undefined): CalcType {
  if (level === "MASTER_OF_SCIENCE") return "master";
  if (level === "INTEGRATED_MASTER") return "clmg";
  return "bachelor";
}

/**
 * The plan that matches the student's saved programme and track, or null when
 * we have none (or can't tell which of several): the screen then opens the
 * picker and says so, rather than quietly showing someone else's exams.
 */
export function defaultPlan(type: CalcType, academic: AcademicProfile | null): string | null {
  return pickPlan(Object.keys(GRADE_PLANS[type]), academic?.programme.code, academic?.track?.code);
}
