import { GRADE_PLANS, newState, type CalcRow, type CalcState, type CalcType } from "@astra/shared";

/**
 * What a calculator saves: the chosen plan and only what the student changed.
 * Rows are rebuilt from the plan, so the value stays well under SecureStore's
 * ~2 KB comfort zone and picks up plan corrections in later releases.
 */
export interface SavedCalc {
  plan: string;
  grades: Record<string, number>;
  noGrade: string[];
  credits: Record<string, number>;
  removed: string[];
  custom: { id: string; name: string; credits: number; year: number }[];
  settings: Pick<CalcState, "internship" | "thesis" | "bonus" | "thesisType" | "onTime" | "athlete" | "target">;
}

export function freshSave(type: CalcType, plan: string): SavedCalc {
  const { internship, thesis, bonus, thesisType, onTime, athlete, target } = newState(
    type,
    plan,
    GRADE_PLANS[type][plan] ?? [],
  );
  return {
    plan,
    grades: {},
    noGrade: [],
    credits: {},
    removed: [],
    custom: [],
    settings: { internship, thesis, bonus, thesisType, onTime, athlete, target },
  };
}

export function toState(type: CalcType, saved: SavedCalc): CalcState {
  const base = newState(type, saved.plan, GRADE_PLANS[type][saved.plan] ?? []);
  const custom: CalcRow[] = saved.custom.map((c) => ({ ...c, kind: "g", grade: null }));
  const rows = [...base.rows, ...custom]
    .filter((r) => !saved.removed.includes(r.id))
    .map((r) => ({
      ...r,
      credits: saved.credits[r.id] ?? r.credits,
      grade: saved.grades[r.id] ?? null,
      noGrade: saved.noGrade.includes(r.id),
    }));
  return { ...base, ...saved.settings, rows };
}
