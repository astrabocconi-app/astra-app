import {
  GRADE_PLANS,
  freshSave as freshSaveFor,
  loadSaved as loadSavedFor,
  switchPlan as switchPlanFor,
  toState as toStateFor,
  type CalcType,
  type PlanSource,
} from "@astra/shared";
import { LEGACY_PLAN_ALIASES, LEGACY_ROW_IDS } from "./calc-legacy-ids";

// The save format and its maths live in @astra/shared (tested there); this binds
// them to the plans and to the frozen map from the positions 1.1.x saved.
export type { SavedCalc, PlanSwitch } from "@astra/shared";

const source: PlanSource = {
  rows: (type, plan) => GRADE_PLANS[type][plan] ?? [],
  legacyAliases: LEGACY_PLAN_ALIASES,
  legacyIds: LEGACY_ROW_IDS,
};

export const freshSave = (type: CalcType, plan: string) => freshSaveFor(type, plan, source);
export const loadSaved = (type: CalcType, raw: unknown) => loadSavedFor(type, raw, source);
export const toState = (type: CalcType, saved: Parameters<typeof toStateFor>[1]) => toStateFor(type, saved, source);
export const switchPlan = (type: CalcType, saved: Parameters<typeof switchPlanFor>[1], plan: string) =>
  switchPlanFor(type, saved, plan, source);
/** Does a plan with this key exist (a save can name one that was renamed away)? */
export const planExists = (type: CalcType, plan: string) => plan in GRADE_PLANS[type];
