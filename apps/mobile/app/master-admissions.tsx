import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import {
  admissionScore,
  outlook,
  weightedAverage,
  MASTER_ADMISSION_DATA,
  MIN_CREDITS,
  type AdmissionRound,
  type Chance,
} from "@astra/shared";
import { Icon } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { SegmentedToggle } from "../components/SegmentedToggle";
import { TextField } from "../components/TextField";
import { useLocale, useT, type TranslationKey } from "../lib/i18n";
import { useSavedState } from "../lib/use-saved-state";
import { toState, type SavedCalc } from "../lib/calc-state";

type Inputs = { gpa: string; credits: string; inCorso: boolean; round: AdmissionRound };

const CHANCE: Record<Chance, { label: TranslationKey; pill: string; text: string }> = {
  likely: { label: "masters.likely", pill: "bg-green-50 dark:bg-green-400/15", text: "text-green-700 dark:text-green-300" },
  possible: { label: "masters.possible", pill: "bg-amber-50 dark:bg-amber-400/15", text: "text-amber-700 dark:text-amber-300" },
  unlikely: { label: "masters.unlikely", pill: "bg-gray-100 dark:bg-white/10", text: "text-gray-600 dark:text-gray-300" },
  unknown: { label: "masters.unknown", pill: "bg-gray-100 dark:bg-white/10", text: "text-gray-400 dark:text-white/50" },
};

const HOW: [TranslationKey, TranslationKey][] = [
  ["masters.how1Title", "masters.how1"],
  ["masters.how2Title", "masters.how2"],
  ["masters.how3Title", "masters.how3"],
  ["masters.how4Title", "masters.how4"],
];

const parse = (s: string) => {
  const n = Number(s.replace(",", ".").trim());
  return s.trim() && Number.isFinite(n) ? n : null;
};

// Students type their GPA (or take it from the grade calculator) and see, per
// MSc, how their admission score compares with last cycle's admits.
export default function MasterAdmissionsScreen() {
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const [inputs, setInputs] = useSavedState<Inputs>("masters.inputs", { gpa: "", credits: "", inCorso: true, round: 1 });
  const [how, setHow] = useState(false);
  const calcAverage = useCalculatorAverage();

  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const set = (patch: Partial<Inputs>) => setInputs((v) => ({ ...v, ...patch }));

  const gpa = parse(inputs.gpa);
  const credits = parse(inputs.credits) ?? MIN_CREDITS[inputs.round];
  const valid = gpa != null && gpa >= 18 && gpa <= 31;
  const score = valid ? admissionScore(gpa, credits, inputs.inCorso, inputs.round) : null;
  const rows = useMemo(
    () => (score == null ? [] : outlook(score, inputs.round, MASTER_ADMISSION_DATA)),
    [score, inputs.round],
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("masters.title")} subtitle={t("masters.subtitle")} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        <SegmentedToggle
          value={String(inputs.round) as "1" | "2"}
          onChange={(v) => set({ round: Number(v) as AdmissionRound })}
          options={[
            { value: "1", label: t("masters.round1") },
            { value: "2", label: t("masters.round2") },
          ]}
        />

        {/* Inputs */}
        <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
          <Field first label={t("masters.gpa")} hint={t("masters.gpaHint")}>
            <TextField
              value={inputs.gpa}
              onChangeText={(v) => set({ gpa: v })}
              keyboardType="decimal-pad"
              placeholder="27,45"
              placeholderTextColor="#9CA3AF"
              maxLength={5}
              accessibilityLabel={t("masters.gpa")}
              className="w-24 rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2.5 text-right text-base font-semibold text-gray-900 dark:text-white"
              style={{ textAlign: "right" }}
            />
          </Field>
          {calcAverage != null && (
            <Pressable
              onPress={() => set({ gpa: calcAverage.toFixed(2) })}
              hitSlop={6}
              className="border-t border-gray-100 dark:border-white/10 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5"
            >
              <Text className="text-sm font-medium text-astra-primary dark:text-white">
                {t("masters.useCalculator", { gpa: fmt(calcAverage) })}
              </Text>
            </Pressable>
          )}
          <Field label={t("masters.credits")} hint={t("masters.creditsHint")}>
            <TextField
              value={inputs.credits}
              onChangeText={(v) => set({ credits: v.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
              placeholder={String(MIN_CREDITS[inputs.round])}
              placeholderTextColor="#9CA3AF"
              maxLength={3}
              accessibilityLabel={t("masters.credits")}
              className="w-24 rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2.5 text-base font-semibold text-gray-900 dark:text-white"
              style={{ textAlign: "right" }}
            />
          </Field>
          <Field label={t("masters.inCorso")} hint={t("masters.inCorsoSub", { min: String(MIN_CREDITS[inputs.round]) })}>
            <Switch
              value={inputs.inCorso}
              onValueChange={(v) => set({ inCorso: v })}
              trackColor={{ true: "#04107E" }}
              accessibilityLabel={t("masters.inCorso")}
            />
          </Field>
        </View>

        {/* Score */}
        <View className="mt-3 rounded-2xl bg-astra-primary dark:bg-white/10 p-5">
          <Text className="text-xs text-white/70">{t("masters.score")}</Text>
          <Text className="mt-1 text-4xl font-semibold text-white" style={{ fontVariant: ["tabular-nums"] }}>
            {score == null ? "—" : fmt(score)}
          </Text>
          <Text className="mt-1 text-xs text-white/70">
            {score == null ? t("masters.enterGpa") : t("masters.scoreOf110", { n: fmt((score * 110) / 30, 1) })}
          </Text>
        </View>

        {/* Programmes */}
        {rows.length > 0 && (
          <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
            {rows.map((r, i) => {
              const c = CHANCE[r.chance];
              return (
                <View
                  key={r.programme.key}
                  className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-gray-100 dark:border-white/10" : ""}`}
                >
                  <View className="flex-1">
                    <Text className="text-[15px] font-medium text-gray-900 dark:text-white" numberOfLines={2}>
                      {r.programme.name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
                      {r.lowest == null
                        ? t("masters.noRoundData")
                        : [
                            t("masters.lowest", { n: fmt(r.lowest) }),
                            r.median != null
                              ? t("masters.median", { n: fmt(r.median), count: String(r.respondents) })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </Text>
                    {r.programme.selective && (
                      <Text className="mt-0.5 text-xs text-gray-400 dark:text-white/50">{t("masters.selective")}</Text>
                    )}
                  </View>
                  <View className={`rounded-full px-2.5 py-1 ${c.pill}`}>
                    <Text className={`text-xs font-semibold ${c.text}`}>{t(c.label)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* How it works */}
        <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
          <Pressable
            onPress={() => setHow((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: how }}
            className="flex-row items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-white/5"
          >
            <Text className="flex-1 text-base font-semibold text-gray-900 dark:text-white">{t("masters.howTitle")}</Text>
            <Icon name={how ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
          </Pressable>
          {how &&
            HOW.map(([title, body]) => (
              <View key={title} className="border-t border-gray-100 dark:border-white/10 px-4 py-3">
                <Text className="text-[15px] font-semibold text-gray-900 dark:text-white">{t(title)}</Text>
                <Text className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-200">{t(body)}</Text>
              </View>
            ))}
        </View>

        <Text className="mt-6 text-center text-[11px] leading-4 text-gray-400 dark:text-white/50">{t("masters.disclaimer")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, hint, first, children }: { label: string; hint: string; first?: boolean; children: ReactNode }) {
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-gray-100 dark:border-white/10"}`}>
      <View className="flex-1">
        <Text className="text-[15px] font-medium text-gray-900 dark:text-white">{label}</Text>
        <Text className="text-xs text-gray-500 dark:text-gray-300">{hint}</Text>
      </View>
      {children}
    </View>
  );
}

/** The bachelor calculator's average, if the student has filled it in. */
function useCalculatorAverage(): number | null {
  const [avg, setAvg] = useState<number | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync("calc.bachelor")
      .then((raw) => {
        if (!raw) return;
        const average = weightedAverage(toState("bachelor", JSON.parse(raw) as SavedCalc)).average;
        if (average != null) setAvg(average);
      })
      .catch(() => {});
  }, []);
  return avg;
}
