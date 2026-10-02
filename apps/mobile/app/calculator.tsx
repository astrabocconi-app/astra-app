import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Switch,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  graduation,
  internshipSlotId,
  isGraded,
  planForTarget,
  thesisMax,
  weightedAverage,
  LODE,
  MIN_GRADE,
  type AcademicProfile,
  type CalcRow,
  type CalcState,
  type CalcType,
} from "@astra/shared";
import { Icon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { SegmentedToggle } from "../components/SegmentedToggle";
import { api } from "../lib/api";
import { useLocale, useT } from "../lib/i18n";
import { useSavedState } from "../lib/use-saved-state";
import { freshSave, toState, type SavedCalc } from "../lib/calc-state";
import { PLAN_NAMES, defaultPlan, plansFor, typeForLevel } from "../lib/calc-plans";
import { TextField } from "../components/TextField";

const GRADES = Array.from({ length: LODE - MIN_GRADE + 1 }, (_, i) => MIN_GRADE + i); // 18…31

// Bachelor, MSc and CLMG graduation-grade calculator. Everything the student
// enters is saved on the phone as they go, one save per degree type, so
// leaving the screen (or the app) never loses a half-filled transcript.
export default function CalculatorScreen() {
  const t = useT();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const academic = me.data?.academicProfile ?? null;
  const [savedType, setType, typeReady] = useSavedState<CalcType | null>("calc.type", null);
  const type = savedType ?? typeForLevel(academic?.programme.level);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("calc.title")} subtitle={t("calc.saved")} />
      <View className="px-4 pt-3">
        <SegmentedToggle
          value={type}
          onChange={setType}
          options={[
            { value: "bachelor", label: t("calc.bachelor") },
            { value: "master", label: t("calc.master") },
            { value: "clmg", label: t("calc.clmg") },
          ]}
        />
      </View>
      {/* Wait for the profile, so a first visit opens on the student's own programme. */}
      {!typeReady || me.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        // Keyed by type: each degree type keeps its own saved transcript.
        <Calculator key={type} type={type} academic={academic} />
      )}
    </SafeAreaView>
  );
}

function Calculator({ type, academic }: { type: CalcType; academic: AcademicProfile | null }) {
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const [saved, setSaved, ready] = useSavedState<SavedCalc | null>(`calc.${type}`, null);
  const [editing, setEditing] = useState<string | null>(null);
  const [planSheet, setPlanSheet] = useState(false);
  const [panel, setPanel] = useState<"graduation" | "simulate" | null>(null);

  useEffect(() => {
    if (ready && !saved) setSaved(freshSave(type, defaultPlan(type, academic)));
  }, [ready, saved, type, academic, setSaved]);

  const state = useMemo(() => (saved ? toState(type, saved) : null), [type, saved]);
  if (!saved || !state) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  const patch = (fn: (s: SavedCalc) => SavedCalc) => setSaved((s) => (s ? fn(s) : s));
  const setting = <K extends keyof SavedCalc["settings"]>(key: K, value: SavedCalc["settings"][K]) =>
    patch((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

  const avg = weightedAverage(state);
  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const gradeLabel = (g: number) => (g === LODE ? t("calc.lode") : String(g));
  const slotId = internshipSlotId(state);
  const hasInternship = state.rows.some((r) => r.kind === "s" || r.kind === "i");
  const editable = type === "master";

  const rowName = (r: CalcRow) => {
    if (r.kind === "s" && state.internship && r.id === slotId) return t("calc.internshipRow");
    if (r.kind === "i") return state.internship ? r.name : t("calc.optionalInstead");
    const slot = /^#(\d+)$/.exec(r.name);
    return slot ? t("calc.optional", { n: slot[1]! }) : r.name;
  };
  const slotRow = state.rows.find((r) => r.id === slotId);

  const years = [...new Set(state.rows.map((r) => r.year))].sort((a, b) => a - b);
  const editingRow = state.rows.find((r) => r.id === editing) ?? null;

  function changePlan(plan: string) {
    setPlanSheet(false);
    if (plan === saved!.plan) return;
    const apply = () => setSaved(freshSave(type, plan));
    if (Object.keys(saved!.grades).length === 0) return apply();
    Alert.alert(t("calc.resetTitle"), t("calc.resetBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("calc.resetConfirm"), style: "destructive", onPress: apply },
    ]);
  }

  function addExam() {
    const id = `c${Date.now()}`;
    const year = years[years.length - 1] ?? 1;
    patch((s) => ({ ...s, custom: [...s.custom, { id, name: t("calc.newExam"), credits: 6, year }] }));
    setEditing(id);
  }

  function startOver() {
    Alert.alert(t("calc.resetTitle"), t("calc.resetBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("calc.resetConfirm"), style: "destructive", onPress: () => setSaved(freshSave(type, saved!.plan)) },
    ]);
  }

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Programme */}
        <Pressable
          onPress={() => setPlanSheet(true)}
          accessibilityRole="button"
          className="flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5"
        >
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-300">{t("calc.programme")}</Text>
            <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
              {PLAN_NAMES[saved.plan] ?? saved.plan}
            </Text>
          </View>
          <Icon name="chevron-down" size={18} color="#9CA3AF" />
        </Pressable>

        {/* Average */}
        <View className="mt-3 rounded-2xl bg-astra-primary dark:bg-white/10 p-5">
          <Text className="text-xs text-white/70">{t("calc.average")}</Text>
          <Text className="mt-1 text-4xl font-semibold text-white" style={{ fontVariant: ["tabular-nums"] }}>
            {avg.average == null ? "—" : fmt(avg.average)}
          </Text>
          <Text className="mt-1 text-xs text-white/70">
            {avg.average == null
              ? t("calc.noGradesYet")
              : [
                  t("calc.creditsDone", { done: String(avg.gradedCredits), total: String(avg.totalCredits) }),
                  t("calc.base", { n: fmt((avg.average / 30) * 110, 1) }),
                  avg.lodeCount ? t("calc.lodes", { n: String(avg.lodeCount) }) : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
          </Text>
        </View>

        {/* Internship */}
        {hasInternship && (
          <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("calc.internship")}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-300">
                {state.rows.some((r) => r.kind === "i")
                  ? t(state.internship ? "calc.internshipMasterOn" : "calc.internshipMasterOff")
                  : state.internship && slotRow
                    ? t("calc.internshipOnSub", { slot: rowName({ ...slotRow, kind: "o" }) })
                    : t("calc.internshipOffSub")}
              </Text>
            </View>
            <Switch
              value={state.internship}
              onValueChange={(on) =>
                patch((s) => ({
                  ...s,
                  // The replaced optional's grade no longer counts; drop it.
                  grades: on && slotId ? omit(s.grades, slotId) : s.grades,
                  // A curricular internship is what earns the +1 (bachelor, CLMG).
                  settings: { ...s.settings, internship: on, bonus: type !== "master" && on ? true : s.settings.bonus },
                }))
              }
              trackColor={{ true: "#04107E" }}
              accessibilityLabel={t("calc.internship")}
            />
          </View>
        )}

        {/* Exams, by year */}
        {years.map((year) => (
          <View key={year} className="mt-6">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
              {t("calc.year", { n: String(year) })}
            </Text>
            <View className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
              {state.rows
                .filter((r) => r.year === year)
                .map((r, i) => {
                  const graded = isGraded(r, state);
                  const replaced = r.kind === "s" && !graded && !r.noGrade;
                  return (
                    <Pressable
                      key={r.id}
                      disabled={replaced || r.kind === "p"}
                      onPress={() => setEditing(r.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${rowName(r)}, ${t("calc.credits", { n: String(r.credits) })}${r.grade != null ? `, ${gradeLabel(r.grade)}` : ""}`}
                      className={`flex-row items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5 ${
                        i > 0 ? "border-t border-gray-100 dark:border-white/10" : ""
                      }`}
                    >
                      <View className="flex-1">
                        <Text
                          className={`text-[15px] ${graded ? "font-medium text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-300"}`}
                          numberOfLines={2}
                        >
                          {rowName(r)}
                        </Text>
                        <Text className="text-xs text-gray-400 dark:text-white/60">
                          {t("calc.credits", { n: String(r.credits) })}
                          {graded ? "" : `  ·  ${t("calc.notCounted")}`}
                        </Text>
                      </View>
                      {graded ? (
                        <View
                          className={`h-9 min-w-[44px] items-center justify-center rounded-xl px-2 ${
                            r.grade != null ? "bg-astra-primary dark:bg-white" : "bg-gray-100 dark:bg-white/10"
                          }`}
                        >
                          <Text
                            className={`text-[15px] font-semibold ${
                              r.grade != null ? "text-white dark:text-astra-primary" : "text-gray-400 dark:text-white/50"
                            }`}
                            style={{ fontVariant: ["tabular-nums"] }}
                          >
                            {r.grade != null ? gradeLabel(r.grade) : "—"}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-xs text-gray-400 dark:text-white/60">
                          {r.kind === "p" || r.noGrade ? t("calc.passFail") : t("calc.noGrade")}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ))}

        <Pressable
          onPress={addExam}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl py-3 active:opacity-70"
          accessibilityRole="button"
        >
          <Icon name="add" size={18} color="#04107E" />
          <Text className="text-sm font-semibold text-astra-primary dark:text-white">{t("calc.addExam")}</Text>
        </Pressable>

        {/* Graduation grade */}
        <PanelButton
          primary
          open={panel === "graduation"}
          label={t("calc.graduate")}
          onPress={() => setPanel(panel === "graduation" ? null : "graduation")}
        />
        {panel === "graduation" && (
          <GraduationPanel state={state} average={avg.average} setting={setting} fmt={fmt} />
        )}

        {/* Simulation */}
        <PanelButton
          open={panel === "simulate"}
          label={t("calc.simulate")}
          onPress={() => setPanel(panel === "simulate" ? null : "simulate")}
        />
        {panel === "simulate" && (
          <SimulationPanel state={state} setting={setting} fmt={fmt} gradeLabel={gradeLabel} rowName={rowName} />
        )}

        <Text className="mt-6 text-center text-[11px] leading-4 text-gray-400 dark:text-white/50">{t("calc.disclaimer")}</Text>
        <Pressable onPress={startOver} hitSlop={8} className="mt-3 self-center py-2" accessibilityRole="button">
          <Text className="text-sm font-medium text-red-600 dark:text-red-300">{t("calc.reset")}</Text>
        </Pressable>
      </ScrollView>

      <GradeSheet
        row={editingRow}
        name={editingRow ? rowName(editingRow) : ""}
        custom={!!editingRow && editingRow.id.startsWith("c")}
        removable={!!editingRow && (editable || editingRow.id.startsWith("c"))}
        gradeLabel={gradeLabel}
        onClose={() => setEditing(null)}
        onGrade={(id, grade) => {
          patch((s) => ({
            ...s,
            grades: grade == null ? omit(s.grades, id) : { ...s.grades, [id]: grade },
            noGrade: s.noGrade.filter((x) => x !== id),
          }));
          if (grade != null) setEditing(null);
        }}
        onNoGrade={(id, on) =>
          patch((s) => ({
            ...s,
            grades: on ? omit(s.grades, id) : s.grades,
            noGrade: on ? [...s.noGrade, id] : s.noGrade.filter((x) => x !== id),
          }))
        }
        onCredits={(id, credits) => patch((s) => ({ ...s, credits: { ...s.credits, [id]: credits } }))}
        onRename={(id, name) =>
          patch((s) => ({ ...s, custom: s.custom.map((c) => (c.id === id ? { ...c, name } : c)) }))
        }
        onRemove={(id) => {
          setEditing(null);
          patch((s) => ({
            ...s,
            removed: id.startsWith("c") ? s.removed : [...s.removed, id],
            custom: s.custom.filter((c) => c.id !== id),
            grades: omit(s.grades, id),
          }));
        }}
      />

      <Sheet visible={planSheet} onClose={() => setPlanSheet(false)} title={t("calc.pickProgramme")}>
        {plansFor(type).map((plan) => (
          <Pressable
            key={plan}
            onPress={() => changePlan(plan)}
            className="flex-row items-center justify-between px-5 py-3.5 active:bg-gray-50 dark:active:bg-white/5"
          >
            <Text
              className={`flex-1 pr-3 text-base ${plan === saved.plan ? "font-semibold text-astra-primary dark:text-white" : "text-gray-900 dark:text-gray-100"}`}
            >
              {PLAN_NAMES[plan] ?? plan}
            </Text>
            {plan === saved.plan && <Icon name="checkmark" size={20} color="#04107E" />}
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

function omit(obj: Record<string, number>, key: string) {
  const { [key]: _drop, ...rest } = obj;
  return rest;
}

type Setting = <K extends keyof SavedCalc["settings"]>(key: K, value: SavedCalc["settings"][K]) => void;

function PanelButton({ label, open, primary, onPress }: { label: string; open: boolean; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      className={`mt-3 flex-row items-center justify-center gap-2 rounded-xl py-3.5 active:opacity-80 ${
        primary ? "bg-astra-primary dark:bg-white/15" : "border border-astra-primary/20 dark:border-white/15"
      }`}
    >
      <Text className={`text-[15px] font-semibold ${primary ? "text-white" : "text-astra-primary dark:text-white"}`}>{label}</Text>
      <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={primary ? "#FFFFFF" : "#04107E"} />
    </Pressable>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const btn = (delta: number, icon: "remove" | "add") => {
    const disabled = value + delta < min || value + delta > max;
    return (
      <Pressable
        disabled={disabled}
        onPress={() => onChange(value + delta)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${icon === "add" ? "+1" : "−1"}`}
        className={`h-10 w-10 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10 ${disabled ? "opacity-40" : "active:opacity-70"}`}
      >
        <Icon name={icon} size={20} color="#04107E" />
      </Pressable>
    );
  };
  return (
    <View className="flex-row items-center gap-3">
      {btn(-1, "remove")}
      <Text className="min-w-[40px] text-center text-lg font-semibold text-gray-900 dark:text-white" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      {btn(1, "add")}
    </View>
  );
}

function SettingRow({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 border-t border-gray-100 dark:border-white/10 px-4 py-3">
      <View className="flex-1">
        <Text className="text-[15px] font-medium text-gray-900 dark:text-white">{title}</Text>
        {sub ? <Text className="text-xs text-gray-500 dark:text-gray-300">{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function GraduationPanel({
  state,
  average,
  setting,
  fmt,
}: {
  state: CalcState;
  average: number | null;
  setting: Setting;
  fmt: (n: number, digits?: number) => string;
}) {
  const t = useT();
  const max = thesisMax(state);
  const result = average == null ? null : graduation(state, average);
  const toggle = (key: "bonus" | "onTime" | "athlete", title: string, sub: string) => (
    <SettingRow title={title} sub={sub}>
      <Switch value={state[key]} onValueChange={(v) => setting(key, v)} trackColor={{ true: "#04107E" }} accessibilityLabel={title} />
    </SettingRow>
  );

  return (
    <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
      {state.type === "master" && (
        <View className="px-4 pb-3 pt-4">
          <Text className="mb-2 text-[15px] font-medium text-gray-900 dark:text-white">{t("calc.thesisType")}</Text>
          <SegmentedToggle
            value={state.thesisType}
            onChange={(v) => {
              setting("thesisType", v);
              if (v === "applied" && state.thesis > 5) setting("thesis", 5);
            }}
            options={[
              { value: "research", label: t("calc.research") },
              { value: "applied", label: t("calc.applied") },
            ]}
          />
        </View>
      )}
      <View className={state.type === "master" ? "" : "-mt-px"}>
        <SettingRow
          title={t("calc.thesis")}
          sub={
            state.type === "bachelor"
              ? t("calc.thesisSubBachelor")
              : state.type === "clmg"
                ? t("calc.thesisSubClmg")
                : t("calc.thesisSubMaster", { n: String(max) })
          }
        >
          <Stepper value={Math.min(state.thesis, max)} min={0} max={max} onChange={(n) => setting("thesis", n)} label={t("calc.thesis")} />
        </SettingRow>
      </View>
      {state.type === "bachelor" && toggle("bonus", t("calc.bonusBachelor"), t("calc.bonusBachelorSub"))}
      {state.type === "clmg" && toggle("bonus", t("calc.bonusClmg"), t("calc.bonusClmgSub"))}
      {state.type === "master" && toggle("onTime", t("calc.onTime"), t("calc.onTimeSub"))}
      {state.type === "master" && toggle("athlete", t("calc.athlete"), t("calc.athleteSub"))}

      <View className="border-t border-gray-100 dark:border-white/10 bg-astra-light dark:bg-white/5 px-4 py-5">
        {result == null ? (
          <Text className="text-center text-gray-500 dark:text-gray-300">{t("calc.noGradesYet")}</Text>
        ) : (
          <>
            <Text className="text-center text-xs text-gray-500 dark:text-gray-300">{t("calc.graduationTitle")}</Text>
            <Text className="mt-1 text-center text-4xl font-semibold text-astra-primary dark:text-white" style={{ fontVariant: ["tabular-nums"] }}>
              {t("calc.result", { n: String(result.grade) })}
            </Text>
            {result.lodePossible && (
              <View className="mt-2 items-center">
                <Text className="text-sm font-semibold text-astra-primary dark:text-white">{t("calc.resultLode")}</Text>
                <Text className="text-center text-xs text-gray-500 dark:text-gray-300">{t("calc.resultLodeSub")}</Text>
              </View>
            )}
            <Text className="mt-3 text-center text-xs text-gray-500 dark:text-gray-300">
              {t("calc.breakdown", {
                base: fmt(result.base, 1),
                thesis: fmt(Math.min(state.thesis, max), 0),
                bonus: fmt(result.extras - Math.min(state.thesis, max), 0),
              })}
            </Text>
            <Text className="mt-1 text-center text-[11px] leading-4 text-gray-400 dark:text-white/50">
              {t("calc.ifYouKeep")}. {t("calc.rounding")}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function SimulationPanel({
  state,
  setting,
  fmt,
  gradeLabel,
  rowName,
}: {
  state: CalcState;
  setting: Setting;
  fmt: (n: number, digits?: number) => string;
  gradeLabel: (g: number) => string;
  rowName: (r: CalcRow) => string;
}) {
  const t = useT();
  const locale = useLocale();
  const sim = planForTarget(state);
  const remaining = state.rows.filter((r) => isGraded(r, state) && r.grade == null);
  const targetLabel = state.target >= 111 ? t("calc.lodeTarget") : String(state.target);

  let body: ReactNode;
  if (sim.noneLeft) body = <Note>{t("calc.simDone")}</Note>;
  else if (sim.impossible) body = <Note>{t("calc.simImpossible")}</Note>;
  else if (sim.alreadySafe) body = <Note>{t("calc.simSafe")}</Note>;
  else {
    const { reaching, total } = sim.combinations;
    const pct = `${((reaching / total) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
    body = (
      <>
        <Text className="text-[15px] font-semibold text-gray-900 dark:text-white">
          {remaining.length === 1
            ? t("calc.simNeedOne", { grade: gradeLabel(sim.uniform!) })
            : t("calc.simNeed", { avg: fmt(sim.neededAverage), n: String(remaining.length) })}
        </Text>
        {remaining.length > 1 && sim.uniform != null && (
          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-200">{t("calc.simUniform", { grade: gradeLabel(sim.uniform) })}</Text>
        )}
        {sim.mixes.length > 0 && (
          <View className="mt-4 gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">{t("calc.simAlternatives")}</Text>
            {sim.mixes.map((m) => {
              const highRows = remaining.filter((_, i) => m.grades[i] === m.high);
              return (
                <View key={`${m.high}-${m.low}-${m.highCount}`} className="rounded-xl bg-astra-light dark:bg-white/10 px-3 py-2.5">
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">
                    {m.highCount === 1
                      ? t("calc.simMixOne", { high: gradeLabel(m.high), exam: rowName(highRows[0]!), low: gradeLabel(m.low) })
                      : t("calc.simMix", { high: gradeLabel(m.high), count: t("calc.exams", { n: String(m.highCount) }), low: gradeLabel(m.low) })}
                  </Text>
                  {m.highCount > 1 && (
                    <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-300" numberOfLines={2}>
                      {highRows.map(rowName).join(", ")}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <Text className="mt-4 text-xs text-gray-500 dark:text-gray-300">
          {total < 1e12
            ? t("calc.simCombos", { reaching: reaching.toLocaleString(locale), total: total.toLocaleString(locale), pct })
            : t("calc.simCombosPct", { pct })}
        </Text>
      </>
    );
  }

  return (
    <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
      <SettingRow title={t("calc.target")}>
        <View className="flex-row items-center gap-3">
          <Pressable
            disabled={state.target <= 66}
            onPress={() => setting("target", state.target - 1)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${t("calc.target")} −1`}
            className={`h-10 w-10 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10 ${state.target <= 66 ? "opacity-40" : "active:opacity-70"}`}
          >
            <Icon name="remove" size={20} color="#04107E" />
          </Pressable>
          <Text className="min-w-[48px] text-center text-lg font-semibold text-gray-900 dark:text-white" style={{ fontVariant: ["tabular-nums"] }}>
            {targetLabel}
          </Text>
          <Pressable
            disabled={state.target >= 111}
            onPress={() => setting("target", state.target + 1)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${t("calc.target")} +1`}
            className={`h-10 w-10 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10 ${state.target >= 111 ? "opacity-40" : "active:opacity-70"}`}
          >
            <Icon name="add" size={20} color="#04107E" />
          </Pressable>
        </View>
      </SettingRow>
      <View className="border-t border-gray-100 dark:border-white/10 px-4 py-4">
        {body}
        {state.target >= 111 && state.type !== "master" && (
          <Text className="mt-3 text-xs text-gray-500 dark:text-gray-300">
            {state.type === "bachelor" ? t("calc.simLodeNote") : t("calc.simLodeNoteClmg")}
          </Text>
        )}
      </View>
    </View>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <Text className="text-[15px] leading-5 text-gray-700 dark:text-gray-200">{children}</Text>;
}

/** Bottom sheet: fading backdrop behind, sheet sliding in front. */
function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} className="justify-end">
        <Pressable style={StyleSheet.absoluteFill} className="bg-black/40" onPress={onClose} accessibilityLabel={t("common.close")} />
        <View className="rounded-t-3xl bg-white dark:bg-astra-primary pt-4" style={{ maxHeight: "80%", paddingBottom: insets.bottom + 12 }}>
          <Text className="px-5 pb-2 text-lg font-semibold text-gray-900 dark:text-white" numberOfLines={2}>
            {title}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GradeSheet({
  row,
  name,
  custom,
  removable,
  gradeLabel,
  onClose,
  onGrade,
  onNoGrade,
  onCredits,
  onRename,
  onRemove,
}: {
  row: CalcRow | null;
  name: string;
  custom: boolean;
  removable: boolean;
  gradeLabel: (g: number) => string;
  onClose: () => void;
  onGrade: (id: string, grade: number | null) => void;
  onNoGrade: (id: string, on: boolean) => void;
  onCredits: (id: string, credits: number) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const action = (label: string, onPress: () => void, destructive?: boolean) => (
    <Pressable onPress={onPress} className="border-t border-gray-100 dark:border-white/10 px-5 py-3.5 active:bg-gray-50 dark:active:bg-white/5">
      <Text className={`text-[15px] font-medium ${destructive ? "text-red-600 dark:text-red-300" : "text-astra-primary dark:text-white"}`}>{label}</Text>
    </Pressable>
  );
  return (
    <Sheet visible={row !== null} onClose={onClose} title={name}>
      {row && (
        <>
          {custom && (
            <View className="mx-5 mb-3 rounded-xl bg-gray-100 dark:bg-white/10 px-3">
              <TextField
                value={row.name}
                onChangeText={(v) => onRename(row.id, v)}
                selectTextOnFocus
                placeholder={t("calc.newExam")}
                placeholderTextColor="#9CA3AF"
                className="py-2.5 text-base text-gray-900 dark:text-white"
              />
            </View>
          )}
          {!row.noGrade && (
            <View className="flex-row flex-wrap gap-1.5 px-5 pb-4">
              {GRADES.map((g) => {
                const selected = row.grade === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => onGrade(row.id, g)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`h-12 w-[12.5%] items-center justify-center rounded-xl ${
                      selected ? "bg-astra-primary dark:bg-white" : "bg-astra-light dark:bg-white/10 active:opacity-70"
                    }`}
                  >
                    <Text
                      className={`text-base font-semibold ${selected ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {gradeLabel(g)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View className="flex-row items-center justify-between border-t border-gray-100 dark:border-white/10 px-5 py-3">
            <Text className="text-[15px] font-medium text-gray-900 dark:text-white">{t("calc.creditsLabel")}</Text>
            <Stepper value={row.credits} min={1} max={30} onChange={(n) => onCredits(row.id, n)} label={t("calc.creditsLabel")} />
          </View>
          {row.grade != null && action(t("calc.clearGrade"), () => onGrade(row.id, null))}
          {action(row.noGrade ? t("calc.markGraded") : t("calc.markPassFail"), () => onNoGrade(row.id, !row.noGrade))}
          {removable && action(t("calc.removeExam"), () => onRemove(row.id), true)}
        </>
      )}
    </Sheet>
  );
}
