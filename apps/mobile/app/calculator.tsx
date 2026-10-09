import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  View,
  Pressable,
  ScrollView,
  Modal,
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
  parseDecimal,
  planForTarget,
  thesisMax,
  weightedAverage,
  LODE,
  MIN_GRADE,
  THESIS_STEP,
  type AcademicProfile,
  type CalcRow,
  type CalcState,
  type CalcType,
} from "@astra/shared";
import { Icon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { SegmentedToggle } from "../components/SegmentedToggle";
import { Text } from "../components/AppText";
import { TextField } from "../components/TextField";
import { AppSwitch } from "../components/AppSwitch";
import { api } from "../lib/api";
import { useLanguage, useLocale, useT, useTn, type TranslationKey } from "../lib/i18n";
import { useSavedState } from "../lib/use-saved-state";
import { freshSave, loadSaved, planExists, switchPlan, toState, type SavedCalc } from "../lib/calc-state";
import { defaultPlan, planCohort, planName, plansFor, typeForLevel } from "../lib/calc-plans";

const GRADES = Array.from({ length: LODE - MIN_GRADE + 1 }, (_, i) => MIN_GRADE + i); // 18…31
const GRADE_COLUMNS = 5;
const TYPES: CalcType[] = ["bachelor", "master", "clmg"];

// Bachelor, MSc and CLMG graduation-grade calculator. Everything the student
// enters is saved on the phone as they go, one save per degree type, so
// leaving the screen (or the app) never loses a half-filled transcript.
export default function CalculatorScreen() {
  const t = useT();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const academic = me.data?.academicProfile ?? null;
  const [savedType, setType, typeReady] = useSavedState<CalcType | null>("calc.type", null, (raw) =>
    TYPES.includes(raw as CalcType) ? (raw as CalcType) : null,
  );
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
          <Spinner accessibilityLabel={t("common.loading")} />
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
  const tn = useTn();
  const locale = useLocale();
  const language = useLanguage();
  const insets = useSafeAreaInsets();
  const [saved, setSaved, ready, info] = useSavedState<SavedCalc | null>(`calc.${type}`, null, (raw) => loadSaved(type, raw));
  const [editing, setEditing] = useState<string | null>(null);
  const [planSheet, setPlanSheet] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [panel, setPanel] = useState<"graduation" | "simulate" | null>(null);

  // The plan for the student's programme, or null when we can't tell which.
  const guess = useMemo(() => defaultPlan(type, academic), [type, academic]);
  const planMissing = !!saved && !planExists(type, saved.plan);

  useEffect(() => {
    // Create the save only when we know the plan: never persist a guess.
    if (ready && !saved && guess) setSaved(freshSave(type, guess));
  }, [ready, saved, guess, type, setSaved]);
  // No plan for this student (or the saved one no longer exists): ask.
  useEffect(() => {
    if (ready && ((!saved && !guess) || planMissing)) setPlanSheet(true);
  }, [ready, saved, guess, planMissing]);

  const needsPick = ready && ((!saved && !guess) || planMissing);
  const state = useMemo(() => (saved && !planMissing ? toState(type, saved) : null), [type, saved, planMissing]);
  const gradeLabel = (g: number) => (g === LODE ? t("calc.lode") : String(g));
  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const patch = (fn: (s: SavedCalc) => SavedCalc) => setSaved((s) => (s ? fn(s) : s));
  const setting = <K extends keyof SavedCalc["settings"]>(key: K, value: SavedCalc["settings"][K]) =>
    patch((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

  const choosePlan = (plan: string) => {
    if (saved && plan === saved.plan && !planMissing) return;
    if (!saved) {
      setSaved(freshSave(type, plan));
      closePlanSheet();
      return;
    }
    const sw = switchPlan(type, saved, plan);
    // Ask only when something the student typed would be lost.
    if (sw.lostGrades > 0 || sw.lostMarks > 0) return setPendingPlan(plan);
    setSaved({ ...sw.saved, notice: undefined });
    closePlanSheet();
  };
  const closePlanSheet = () => {
    setPlanSheet(false);
    setPendingPlan(null);
  };

  const banners = (
    <>
      {info.status === "invalid" && <Banner tone="warn">{t("calc.invalidSave")}</Banner>}
      {info.status === "unreadable" && <Banner tone="warn">{t("calc.unreadable")}</Banner>}
      {info.saveFailed && <Banner tone="warn">{t("calc.saveFailed")}</Banner>}
      {saved?.notice && (
        <Banner tone="info" action={t("calc.gotIt")} onAction={() => patch((s) => ({ ...s, notice: undefined }))}>
          {t("calc.lostNotice", { what: tn("calc.grades", saved.notice.lost, { n: String(saved.notice.lost) }) })}
        </Banner>
      )}
    </>
  );

  const planSheetView = (
    <PlanSheet
      visible={planSheet}
      type={type}
      current={saved && !planMissing ? saved.plan : null}
      note={!saved || planMissing ? (academic ? t("calc.noPlan") : null) : null}
      pending={pendingPlan}
      preview={saved && pendingPlan ? switchPlan(type, saved, pendingPlan) : null}
      onPick={choosePlan}
      onConfirm={() => {
        if (saved && pendingPlan) setSaved({ ...switchPlan(type, saved, pendingPlan).saved, notice: undefined });
        closePlanSheet();
      }}
      onBack={() => setPendingPlan(null)}
      onClose={closePlanSheet}
    />
  );

  if (!saved || !state) {
    return (
      <>
        <View className="flex-1 items-center justify-center px-6">
          {needsPick ? (
            <Pressable
              onPress={() => setPlanSheet(true)}
              accessibilityRole="button"
              className="min-h-[48px] items-center justify-center rounded-2xl bg-astra-primary dark:bg-white/15 px-6 py-3"
            >
              <Text chrome className="text-[15px] font-semibold text-white">
                {t("calc.pickProgramme")}
              </Text>
            </Pressable>
          ) : (
            <Spinner accessibilityLabel={t("common.loading")} />
          )}
          {banners}
        </View>
        {planSheetView}
      </>
    );
  }

  const avg = weightedAverage(state);
  const slotId = internshipSlotId(state);
  const hasInternship = state.rows.some((r) => r.kind === "s" || r.kind === "i");
  const editable = type === "master";
  const credits = (n: number) => tn("calc.credits", n, { n: String(n) });

  const rowName = (r: CalcRow) => {
    if (r.kind === "s" && state.internship && r.id === slotId) return t("calc.internshipRow");
    if (r.kind === "i") return state.internship ? r.name : t("calc.optionalInstead");
    if (r.kind === "p" && r.name === "Internship") return t("calc.internshipRow");
    const slot = /^#(\d+)$/.exec(r.name);
    if (slot) return t("calc.optional", { n: slot[1]! });
    const token = /^@(\w+)$/.exec(r.name);
    if (token) return t(`calc.${token[1]}` as TranslationKey);
    return r.name;
  };
  const slotRow = state.rows.find((r) => r.id === slotId);

  const years = [...new Set(state.rows.map((r) => r.year))].sort((a, b) => a - b);
  const editingRow = state.rows.find((r) => r.id === editing) ?? null;
  const cohort = planCohort(type, saved.plan);

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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        {banners}

        {/* Programme */}
        <Pressable
          onPress={() => setPlanSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t("calc.programme")}: ${planName(saved.plan, language)}`}
          accessibilityHint={t("calc.pickProgramme")}
          className="min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5"
        >
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-300">{t("calc.programme")}</Text>
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{planName(saved.plan, language)}</Text>
            <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
              {cohort.cohort && !cohort.legacy ? t("calc.planCaption", { cohort: cohort.cohort }) : t("calc.planOlder")}
            </Text>
          </View>
          <Icon name="chevron-down" size={18} color="#6B7280" />
        </Pressable>

        {/* Average */}
        <View
          className="mt-3 rounded-2xl bg-astra-primary dark:bg-white/10 p-5"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${t("calc.average")} ${avg.average == null ? t("calc.noGradesYet") : fmt(avg.average)}`}
        >
          <Text className="text-xs text-white/70">{t("calc.average")}</Text>
          <Text className="mt-1 text-4xl font-semibold text-white" style={{ fontVariant: ["tabular-nums"] }}>
            {avg.average == null ? "—" : fmt(avg.average)}
          </Text>
          <Text className="mt-1 text-xs text-white/70">
            {avg.average == null
              ? t("calc.noGradesYet")
              : [
                  t("calc.creditsDone", { done: fmt(avg.gradedCredits, avg.gradedCredits % 1 ? 1 : 0), total: fmt(avg.totalCredits, avg.totalCredits % 1 ? 1 : 0) }),
                  t("calc.base", { n: fmt((avg.average / 30) * 110, 1) }),
                  avg.lodeCount ? t("calc.lodes", { n: String(avg.lodeCount) }) : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
          </Text>
        </View>

        {/* Internship: only bachelor plans, where it replaces an optional. An MSc internship is a plain pass/fail row. */}
        {hasInternship && (
          <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("calc.internship")}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-300">
                {state.internship && slotRow
                  ? t("calc.internshipOnSub", { slot: rowName({ ...slotRow, kind: "o" }) })
                  : t("calc.internshipOffSub")}
              </Text>
            </View>
            <AppSwitch
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
              label={t("calc.internship")}
            />
          </View>
        )}

        {/* Exams, by year */}
        {years.map((year) => (
          <View key={year} className="mt-6">
            <Text
              accessibilityRole="header"
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/60"
            >
              {t("calc.year", { n: String(year) })}
            </Text>
            <View className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
              {state.rows
                .filter((r) => r.year === year)
                .map((r, i) => {
                  const graded = isGraded(r, state);
                  // Nothing to enter on a row that is pass/fail by rule, or replaced by the internship.
                  const fixed = !graded && !r.noGrade;
                  return (
                    <Pressable
                      key={r.id}
                      disabled={fixed}
                      onPress={() => setEditing(r.id)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: fixed }}
                      accessibilityHint={fixed ? undefined : t("calc.rowHint")}
                      accessibilityLabel={[
                        rowName(r),
                        credits(r.credits),
                        graded ? (r.grade != null ? (r.grade === LODE ? t("calc.lodeFull") : String(r.grade)) : t("calc.noGrade")) : r.kind === "p" || r.noGrade ? t("calc.passFail") : t("calc.notCounted"),
                      ].join(", ")}
                      className={`min-h-[56px] flex-row items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5 ${
                        i > 0 ? "border-t border-gray-100 dark:border-white/10" : ""
                      }`}
                    >
                      <View className="flex-1">
                        <Text
                          className={`text-[15px] ${graded ? "font-medium text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}
                          numberOfLines={3}
                        >
                          {rowName(r)}
                        </Text>
                        <Text className="text-xs text-gray-500 dark:text-white/60">
                          {credits(r.credits)}
                          {graded ? "" : `  ·  ${t("calc.notCounted")}`}
                        </Text>
                      </View>
                      {graded ? (
                        <View
                          className={`min-h-[36px] min-w-[44px] items-center justify-center rounded-xl px-2 ${
                            r.grade != null ? "bg-astra-primary dark:bg-white" : "bg-gray-100 dark:bg-white/10"
                          }`}
                        >
                          <Text
                            chrome
                            className={`text-[15px] font-semibold ${
                              r.grade != null ? "text-white dark:text-astra-primary" : "text-gray-500 dark:text-white/60"
                            }`}
                            style={{ fontVariant: ["tabular-nums"] }}
                          >
                            {r.grade != null ? gradeLabel(r.grade) : "—"}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-xs text-gray-500 dark:text-white/60">
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
          className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl py-3 active:opacity-70"
          accessibilityRole="button"
        >
          <Icon name="add" size={18} color="#04107E" />
          <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">{t("calc.addExam")}</Text>
        </Pressable>

        {/* Graduation grade */}
        <PanelButton
          primary
          open={panel === "graduation"}
          label={t("calc.graduate")}
          onPress={() => setPanel(panel === "graduation" ? null : "graduation")}
        />
        {panel === "graduation" && (
          <GraduationPanel
            state={state}
            average={avg.average}
            ratio={avg.ratio}
            direct={saved.direct ?? { on: avg.average == null, average: "" }}
            onDirect={(direct) => patch((s) => ({ ...s, direct }))}
            setting={setting}
            fmt={fmt}
          />
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

        <Text className="mt-6 text-center text-[11px] leading-4 text-gray-500 dark:text-white/60">{t("calc.disclaimer")}</Text>
        <Pressable onPress={startOver} hitSlop={8} className="mt-3 min-h-[44px] items-center justify-center self-center px-4" accessibilityRole="button">
          <Text chrome className="text-sm font-medium text-red-700 dark:text-red-300">{t("calc.reset")}</Text>
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
        onCredits={(id, c) => patch((s) => ({ ...s, credits: { ...s.credits, [id]: c } }))}
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

      {planSheetView}
    </>
  );
}

function omit(obj: Record<string, number>, key: string) {
  const { [key]: _drop, ...rest } = obj;
  return rest;
}

type Setting = <K extends keyof SavedCalc["settings"]>(key: K, value: SavedCalc["settings"][K]) => void;

function Banner({
  tone,
  children,
  action,
  onAction,
}: {
  tone: "warn" | "info";
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`mb-3 flex-row items-center gap-3 rounded-2xl px-4 py-3 ${
        tone === "warn" ? "bg-amber-50 dark:bg-amber-400/15" : "bg-astra-light dark:bg-white/10"
      }`}
    >
      <Text className={`flex-1 text-sm leading-5 ${tone === "warn" ? "text-amber-900 dark:text-amber-200" : "text-gray-800 dark:text-gray-100"}`}>
        {children}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" className="min-h-[44px] items-center justify-center px-2">
          <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PanelButton({ label, open, primary, onPress }: { label: string; open: boolean; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      className={`mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl py-3.5 active:opacity-80 ${
        primary ? "bg-astra-primary dark:bg-white/15" : "border border-astra-primary/20 dark:border-white/15"
      }`}
    >
      <Text chrome className={`text-[15px] font-semibold ${primary ? "text-white" : "text-astra-primary dark:text-white"}`}>{label}</Text>
      <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={primary ? "#FFFFFF" : "#04107E"} />
    </Pressable>
  );
}

/** − value + with 44pt buttons. `shown` formats the value (110L for a lode target). */
function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  shown,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  label: string;
  shown?: string;
}) {
  const t = useT();
  const btn = (delta: number, icon: "remove" | "add") => {
    const next = value + delta;
    const disabled = next < min - 1e-9 || next > max + 1e-9;
    return (
      <Pressable
        disabled={disabled}
        onPress={() => onChange(next)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={t(icon === "add" ? "calc.stepUp" : "calc.stepDown", { label })}
        className={`h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10 ${disabled ? "opacity-40" : "active:opacity-70"}`}
      >
        <Icon name={icon} size={20} color="#04107E" />
      </Pressable>
    );
  };
  return (
    <View className="flex-row items-center gap-2">
      {btn(-step, "remove")}
      <Text
        chrome
        accessibilityLiveRegion="polite"
        className="min-w-[44px] text-center text-lg font-semibold text-gray-900 dark:text-white"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {shown ?? String(value)}
      </Text>
      {btn(step, "add")}
    </View>
  );
}

function SettingRow({ title, sub, children, stack }: { title: string; sub?: string; children: ReactNode; stack?: ReactNode }) {
  return (
    <View className="border-t border-gray-100 dark:border-white/10 px-4 py-3">
      <View className="min-h-[44px] flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-[15px] font-medium text-gray-900 dark:text-white">{title}</Text>
          {sub ? <Text className="text-xs text-gray-500 dark:text-gray-300">{sub}</Text> : null}
        </View>
        <View style={{ flexShrink: 0 }}>{children}</View>
      </View>
      {stack}
    </View>
  );
}

function GraduationPanel({
  state,
  average,
  ratio,
  direct,
  onDirect,
  setting,
  fmt,
}: {
  state: CalcState;
  average: number | null;
  ratio: { num: number; den: number } | null;
  direct: NonNullable<SavedCalc["direct"]>;
  onDirect: (direct: NonNullable<SavedCalc["direct"]>) => void;
  setting: Setting;
  fmt: (n: number, digits?: number) => string;
}) {
  const t = useT();
  const max = thesisMax(state);
  // Either the exams entered so far, or an average the student types in.
  const typed = parseDecimal(direct.average);
  const typedValid = typed != null && typed >= 18 && typed <= 31;
  const typedInvalid = direct.on && direct.average.trim() !== "" && !typedValid;
  const used = direct.on ? (typedValid ? typed : null) : ratio;
  const result = used == null || (!direct.on && average == null) ? null : graduation(state, used);
  const thesis = Math.min(state.thesis, max);
  return (
    <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
      <View className="px-4 pb-3 pt-4">
        <SegmentedToggle
          value={direct.on ? "direct" : "exams"}
          onChange={(v) => onDirect({ ...direct, on: v === "direct" })}
          options={[
            { value: "exams", label: t("calc.fromExams") },
            { value: "direct", label: t("calc.directAverage") },
          ]}
        />
      </View>
      {direct.on && (
        <SettingRow title={t("calc.averageLabel")} sub={t("calc.averageHint")}>
          <TextField
            value={direct.average}
            onChangeText={(v) => onDirect({ ...direct, average: v.replace(/[^0-9.,]/g, "") })}
            keyboardType="decimal-pad"
            returnKeyType="done"
            placeholder={fmt(27.4)}
            placeholderTextColor="#6B7280"
            maxLength={5}
            accessibilityLabel={t("calc.averageLabel")}
            accessibilityHint={t("calc.averageHint")}
            className="min-h-[44px] rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2.5 text-base font-semibold text-gray-900 dark:text-white"
            style={{ textAlign: "right", minWidth: 96 }}
          />
        </SettingRow>
      )}
      {typedInvalid && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="px-4 pb-2 text-sm text-red-700 dark:text-red-300">
          {t("calc.averageInvalid")}
        </Text>
      )}
      <ExtrasInputs state={state} setting={setting} thesisTitle={t("calc.thesis")} fmt={fmt} />

      <View
        className="border-t border-gray-100 dark:border-white/10 bg-astra-light dark:bg-white/5 px-4 py-5"
        accessibilityLiveRegion="polite"
      >
        {result == null ? (
          <Text className="text-center text-gray-600 dark:text-gray-300">
            {direct.on ? t("calc.enterAverage") : t("calc.noGradesYet")}
          </Text>
        ) : (
          <>
            <Text className="text-center text-xs text-gray-600 dark:text-gray-300">{t("calc.graduationTitle")}</Text>
            <Text className="mt-1 text-center text-4xl font-semibold text-astra-primary dark:text-white" style={{ fontVariant: ["tabular-nums"] }}>
              {t("calc.result", { n: String(result.grade) })}
            </Text>
            {result.lodePossible && (
              <View className="mt-2 items-center">
                <Text className="text-sm font-semibold text-astra-primary dark:text-white">{t("calc.resultLode")}</Text>
                <Text className="text-center text-xs text-gray-600 dark:text-gray-300">{t("calc.resultLodeSub")}</Text>
              </View>
            )}
            <Text className="mt-3 text-center text-xs text-gray-600 dark:text-gray-300">
              {t("calc.breakdown", {
                base: fmt(result.base, 1),
                thesis: fmt(thesis, thesis % 1 ? 1 : 0),
                bonus: fmt(result.extras - thesis, (result.extras - thesis) % 1 ? 1 : 0),
              })}
            </Text>
            <Text className="mt-1 text-center text-[11px] leading-4 text-gray-600 dark:text-white/60">
              {direct.on ? t("calc.rounding") : `${t("calc.ifYouKeep")}. ${t("calc.rounding")}`}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

/** Final paper points and bonuses: they feed both the grade and the simulation. */
function ExtrasInputs({
  state,
  setting,
  thesisTitle,
  fmt,
}: {
  state: CalcState;
  setting: Setting;
  thesisTitle: string;
  fmt: (n: number, digits?: number) => string;
}) {
  const t = useT();
  const max = thesisMax(state);
  const thesis = Math.min(state.thesis, max);
  const toggle = (key: "bonus" | "onTime" | "athlete", title: string, sub: string) => (
    <SettingRow title={title} sub={sub}>
      <AppSwitch value={state[key]} onValueChange={(v) => setting(key, v)} label={title} />
    </SettingRow>
  );

  return (
    <>
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
      <SettingRow
        title={thesisTitle}
        sub={
          state.type === "bachelor"
            ? t("calc.thesisSubBachelor")
            : state.type === "clmg"
              ? t("calc.thesisSubClmg")
              : t("calc.thesisSubMaster", { n: String(max) })
        }
      >
        <Stepper
          value={thesis}
          min={0}
          max={max}
          step={THESIS_STEP}
          onChange={(n) => setting("thesis", n)}
          label={t("calc.thesis")}
          shown={fmt(thesis, thesis % 1 ? 1 : 0)}
        />
      </SettingRow>
      {state.type === "bachelor" && toggle("bonus", t("calc.bonusBachelor"), t("calc.bonusBachelorSub"))}
      {state.type === "clmg" && toggle("bonus", t("calc.bonusClmg"), t("calc.bonusClmgSub"))}
      {state.type === "master" && toggle("onTime", t("calc.onTime"), t("calc.onTimeSub"))}
      {state.type === "master" && toggle("athlete", t("calc.athlete"), t("calc.athleteSub"))}
    </>
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
  const tn = useTn();
  const locale = useLocale();
  // The planner is the heavy part; keep the steppers snappy by computing it
  // from a deferred copy of the state, and only when the inputs change.
  const deferred = useDeferredValue(state);
  const sim = useMemo(() => planForTarget(deferred), [deferred]);
  const stale = deferred !== state;
  const remaining = deferred.rows.filter((r) => isGraded(r, deferred) && r.grade == null);
  const targetLabel = (n: number) => (n >= 111 ? t("calc.lodeTarget") : String(n));

  let body: ReactNode;
  if (sim.lodeBlocked) body = <Note>{state.type === "bachelor" ? t("calc.simLodeBlocked") : t("calc.simLodeBlockedClmg")}</Note>;
  else if (sim.noneLeft) {
    body = (
      <Note>
        {sim.met == null
          ? t("calc.simDoneNone")
          : t(sim.met ? "calc.simDoneMet" : "calc.simDoneMissed", { target: targetLabel(state.target) })}
      </Note>
    );
  } else if (sim.impossible) body = <Note>{t("calc.simImpossible")}</Note>;
  else if (sim.alreadySafe) body = <Note>{t("calc.simSafe")}</Note>;
  else {
    const combos = sim.combinations;
    const pct = combos ? `${((combos.reaching / combos.total) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%` : "";
    body = (
      <>
        {/* The answer most students want, stated first and big: one grade to
            get in every exam left. */}
        {sim.uniform != null && (
          <View className="items-center rounded-2xl bg-astra-primary dark:bg-white/10 px-4 py-5">
            <Text className="text-xs font-medium text-white/70">{t("calc.simSimplest")}</Text>
            <Text
              className="mt-1 text-5xl font-semibold text-white"
              style={{ fontVariant: ["tabular-nums"] }}
              accessibilityLabel={sim.uniform === LODE ? t("calc.lodeFull") : String(sim.uniform)}
            >
              {gradeLabel(sim.uniform)}
            </Text>
            <Text className="mt-1 text-center text-sm text-white/80">
              {remaining.length === 1 ? t("calc.simSimplestOne") : t("calc.simSimplestSub", { n: String(remaining.length) })}
            </Text>
          </View>
        )}
        {remaining.length > 1 && (
          <Text className="mt-3 text-center text-sm text-gray-700 dark:text-gray-200">
            {t("calc.simNeed", { avg: fmt(sim.neededAverage), n: String(remaining.length) })}
          </Text>
        )}
        {sim.mixes.length > 0 && (
          <View className="mt-4 gap-2">
            <Text accessibilityRole="header" className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/60">
              {t("calc.simAlternatives")}
            </Text>
            {sim.mixes.map((m) => {
              const highRows = remaining.filter((_, i) => m.grades[i] === m.high);
              return (
                <View key={`${m.high}-${m.low}-${m.highCount}`} className="rounded-xl bg-astra-light dark:bg-white/10 px-3 py-2.5">
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">
                    {m.highCount === 1
                      ? t("calc.simMixOne", { high: gradeLabel(m.high), exam: rowName(highRows[0]!), low: gradeLabel(m.low) })
                      : t("calc.simMix", {
                          high: gradeLabel(m.high),
                          count: tn("calc.exams", m.highCount, { n: String(m.highCount) }),
                          low: gradeLabel(m.low),
                        })}
                  </Text>
                  {m.highCount > 1 && (
                    <Text className="mt-0.5 text-xs text-gray-600 dark:text-gray-300" numberOfLines={3}>
                      {highRows.map(rowName).join(", ")}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {combos && (
          <>
            <Text className="mt-4 text-xs text-gray-600 dark:text-gray-300">
              {combos.total < 1e12 && !combos.approximate
                ? t("calc.simCombos", { reaching: combos.reaching.toLocaleString(locale), total: combos.total.toLocaleString(locale) })
                : t("calc.simCombosPct", { pct })}
            </Text>
            <Text className="mt-1 text-xs text-gray-500 dark:text-white/60">{t("calc.simCombosNote")}</Text>
          </>
        )}
      </>
    );
  }

  return (
    <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
      {/* The thesis points the student aims for change what the exams need. */}
      <ExtrasInputs state={state} setting={setting} thesisTitle={t("calc.thesisAim")} fmt={fmt} />
      <SettingRow title={t("calc.target")}>
        <Stepper
          value={state.target}
          min={66}
          max={111}
          onChange={(n) => setting("target", n)}
          label={t("calc.target")}
          shown={targetLabel(state.target)}
        />
      </SettingRow>
      <View
        className="border-t border-gray-100 dark:border-white/10 px-4 py-4"
        style={{ opacity: stale ? 0.6 : 1 }}
        accessibilityLiveRegion="polite"
      >
        {body}
        {state.target >= 111 && state.type !== "master" && !sim.lodeBlocked && (
          <Text className="mt-3 text-xs text-gray-600 dark:text-gray-300">
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} className="justify-end">
        <Pressable style={StyleSheet.absoluteFill} className="bg-black/40" onPress={onClose} accessibilityLabel={t("common.close")} accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          className="rounded-t-3xl bg-white dark:bg-astra-primary pt-4"
          style={{ maxHeight: "85%", paddingBottom: insets.bottom + 12 }}
        >
          <Text accessibilityRole="header" className="px-5 pb-2 text-lg font-semibold text-gray-900 dark:text-white" numberOfLines={3}>
            {title}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PlanSheet({
  visible,
  type,
  current,
  note,
  pending,
  preview,
  onPick,
  onConfirm,
  onBack,
  onClose,
}: {
  visible: boolean;
  type: CalcType;
  current: string | null;
  note: string | null;
  pending: string | null;
  preview: ReturnType<typeof switchPlan> | null;
  onPick: (plan: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const tn = useTn();
  const language = useLanguage();
  // Asking happens inside the sheet: an Alert raised while a Modal is closing is dropped on iOS.
  const asking = pending && preview;
  return (
    <Sheet
      visible={visible}
      onClose={asking ? onBack : onClose}
      title={asking ? t("calc.switchTitle", { plan: planName(pending, language) }) : t("calc.pickProgramme")}
    >
      {asking ? (
        <>
          <View className="gap-2 px-5 pb-4">
            <Text className="text-[15px] leading-5 text-gray-700 dark:text-gray-200">{t("calc.switchBody")}</Text>
            {preview.keptGrades > 0 && (
              <Text className="text-[15px] leading-5 text-gray-700 dark:text-gray-200">
                {t("calc.switchKept", { what: tn("calc.grades", preview.keptGrades, { n: String(preview.keptGrades) }) })}
              </Text>
            )}
            {preview.lostGrades > 0 && (
              <Text className="text-[15px] font-medium leading-5 text-red-700 dark:text-red-300">
                {t("calc.switchLost", { what: tn("calc.grades", preview.lostGrades, { n: String(preview.lostGrades) }) })}
              </Text>
            )}
            {preview.lostMarks > 0 && <Text className="text-[15px] leading-5 text-gray-700 dark:text-gray-200">{t("calc.switchMarks")}</Text>}
          </View>
          <SheetAction label={t("calc.switchConfirm")} onPress={onConfirm} destructive />
          <SheetAction label={t("common.cancel")} onPress={onBack} />
        </>
      ) : (
        <>
          {note ? (
            <View accessibilityRole="alert" className="mx-5 mb-2 rounded-xl bg-amber-50 dark:bg-amber-400/15 px-3 py-2.5">
              <Text className="text-sm leading-5 text-amber-900 dark:text-amber-200">{note}</Text>
            </View>
          ) : null}
          {plansFor(type, language).map((plan) => {
            const meta = planCohort(type, plan);
            const selected = plan === current;
            const caption = meta.cohort && !meta.legacy ? t("calc.planCaption", { cohort: meta.cohort }) : t("calc.planOlder");
            return (
              <Pressable
                key={plan}
                onPress={() => onPick(plan)}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={`${planName(plan, language)}, ${caption}`}
                className="min-h-[52px] flex-row items-center justify-between px-5 py-3 active:bg-gray-50 dark:active:bg-white/5"
              >
                <View className="flex-1 pr-3">
                  <Text className={`text-base ${selected ? "font-semibold text-astra-primary dark:text-white" : "text-gray-900 dark:text-gray-100"}`}>
                    {planName(plan, language)}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-300">{caption}</Text>
                </View>
                {selected && <Icon name="checkmark" size={20} color="#04107E" />}
              </Pressable>
            );
          })}
        </>
      )}
    </Sheet>
  );
}

function SheetAction({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-[52px] justify-center border-t border-gray-100 dark:border-white/10 px-5 py-3 active:bg-gray-50 dark:active:bg-white/5"
    >
      <Text chrome className={`text-[15px] font-medium ${destructive ? "text-red-700 dark:text-red-300" : "text-astra-primary dark:text-white"}`}>{label}</Text>
    </Pressable>
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
                maxLength={60}
                placeholder={t("calc.newExam")}
                placeholderTextColor="#6B7280"
                accessibilityLabel={t("calc.examName")}
                className="min-h-[44px] py-2.5 text-base text-gray-900 dark:text-white"
              />
            </View>
          )}
          {!row.noGrade && (
            <View className="flex-row flex-wrap px-4 pb-4" accessibilityRole="radiogroup">
              {GRADES.map((g) => {
                const selected = row.grade === g;
                return (
                  // Five to a row: wide enough for "30L" at large text, tall enough to hit.
                  <View key={g} style={{ width: `${100 / GRADE_COLUMNS}%`, padding: 3 }}>
                    <Pressable
                      onPress={() => onGrade(row.id, g)}
                      accessibilityRole="radio"
                      accessibilityLabel={g === LODE ? t("calc.lodeFull") : String(g)}
                      accessibilityState={{ selected, checked: selected }}
                      className={`min-h-[48px] items-center justify-center rounded-xl px-1 ${
                        selected ? "bg-astra-primary dark:bg-white" : "bg-astra-light dark:bg-white/10 active:opacity-70"
                      }`}
                    >
                      <Text
                        chrome
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        className={`text-base font-semibold ${selected ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {gradeLabel(g)}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
          {/* Plan exams have fixed credits; only an exam the student added needs them. */}
          {custom && (
            <View className="min-h-[56px] flex-row items-center justify-between gap-3 border-t border-gray-100 dark:border-white/10 px-5 py-2">
              <Text className="flex-1 text-[15px] font-medium text-gray-900 dark:text-white">{t("calc.creditsLabel")}</Text>
              <Stepper value={row.credits} min={1} max={30} onChange={(n) => onCredits(row.id, n)} label={t("calc.creditsLabel")} />
            </View>
          )}
          {row.grade != null && <SheetAction label={t("calc.clearGrade")} onPress={() => onGrade(row.id, null)} />}
          <SheetAction label={row.noGrade ? t("calc.markGraded") : t("calc.markPassFail")} onPress={() => onNoGrade(row.id, !row.noGrade)} />
          {removable && <SheetAction label={t("calc.removeExam")} onPress={() => onRemove(row.id)} destructive />}
        </>
      )}
    </Sheet>
  );
}
