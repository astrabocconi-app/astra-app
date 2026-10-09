import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import {
  admissionAverage,
  outlook,
  scoreForInputs,
  MASTER_ADMISSION_DATA,
  MAX_CREDITS,
  MIN_CREDITS,
  type AdmissionRound,
  type ProgrammeOutlook,
  type Standing,
} from "@astra/shared";
import { Icon } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { SegmentedToggle } from "../components/SegmentedToggle";
import { TextField } from "../components/TextField";
import { AppSwitch } from "../components/AppSwitch";
import { Text } from "../components/AppText";
import { useLocale, useT, useTn, type TranslationKey } from "../lib/i18n";
import { useSavedState } from "../lib/use-saved-state";
import { loadSaved, toState } from "../lib/calc-state";

type Inputs = { gpa: string; credits: string; inCorso: boolean; round: AdmissionRound };

const DEFAULT_INPUTS: Inputs = { gpa: "", credits: "", inCorso: true, round: 1 };

const validateInputs = (raw: unknown): Inputs | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    gpa: typeof r.gpa === "string" ? r.gpa.slice(0, 5) : "",
    credits: typeof r.credits === "string" ? r.credits.slice(0, 3) : "",
    inCorso: typeof r.inCorso === "boolean" ? r.inCorso : true,
    round: r.round === 2 ? 2 : 1,
  };
};

// Green, amber and two greys: chips never rely on colour alone, they say it.
const STANDING: Record<Standing, { label: TranslationKey; pill: string; text: string }> = {
  above: { label: "masters.standingAbove", pill: "bg-green-50 dark:bg-green-400/15", text: "text-green-800 dark:text-green-300" },
  close: { label: "masters.standingClose", pill: "bg-amber-50 dark:bg-amber-400/15", text: "text-amber-800 dark:text-amber-300" },
  below: { label: "masters.standingBelow", pill: "bg-gray-100 dark:bg-white/10", text: "text-gray-700 dark:text-gray-200" },
  none: { label: "masters.standingNone", pill: "bg-gray-100 dark:bg-white/10", text: "text-gray-600 dark:text-gray-300" },
};

const HOW: [TranslationKey, TranslationKey][] = [
  ["masters.how1Title", "masters.how1"],
  ["masters.how2Title", "masters.how2"],
  ["masters.how3Title", "masters.how3"],
  ["masters.how4Title", "masters.how4"],
  ["masters.howDataTitle", "masters.howData"],
];

// Students type their GPA (or take it from the grade calculator) and see, per
// MSc, where their admission score sits against what past admits reported.
export default function MasterAdmissionsScreen() {
  const t = useT();
  const tn = useTn();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const [inputs, setInputs] = useSavedState<Inputs>("masters.inputs", DEFAULT_INPUTS, validateInputs);
  const [how, setHow] = useState(false);
  const calcAverage = useCalculatorAverage();

  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const set = (patch: Partial<Inputs>) => setInputs((v) => ({ ...v, ...patch }));

  const min = MIN_CREDITS[inputs.round];
  const result = scoreForInputs(inputs);
  const score = result.score;
  const rows = useMemo(() => (score == null ? [] : outlook(score, inputs.round, MASTER_ADMISSION_DATA)), [score, inputs.round]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("masters.title")} subtitle={t("masters.subtitle")} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
          <Field first label={t("masters.gpa")} hint={t("masters.gpaHint")} error={result.error === "gpa" ? t("masters.gpaError") : null}>
            <TextField
              value={inputs.gpa}
              onChangeText={(v) => set({ gpa: v.replace(/[^0-9.,]/g, "") })}
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder={fmt(27.45)}
              placeholderTextColor="#6B7280"
              maxLength={5}
              accessibilityLabel={t("masters.gpa")}
              accessibilityHint={t("masters.gpaHint")}
              className="min-h-[44px] rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2.5 text-base font-semibold text-gray-900 dark:text-white"
              style={{ textAlign: "right", minWidth: 96 }}
            />
          </Field>
          {calcAverage != null && (
            <Pressable
              onPress={() => set({ gpa: fmt(calcAverage) })}
              accessibilityRole="button"
              accessibilityHint={t("masters.useCalculatorHint")}
              className="min-h-[48px] justify-center border-t border-gray-100 dark:border-white/10 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5"
            >
              <Text className="text-sm font-medium text-astra-primary dark:text-white">
                {t("masters.useCalculator", { gpa: fmt(calcAverage) })}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-300">{t("masters.useCalculatorHint")}</Text>
            </Pressable>
          )}
          <Field
            label={t("masters.credits")}
            hint={inputs.inCorso ? t("masters.creditsHint", { min: String(min) }) : t("masters.creditsHintOff")}
            error={result.error === "credits" ? t("masters.creditsError", { min: String(min) }) : null}
          >
            <TextField
              value={inputs.credits}
              onChangeText={(v) => set({ credits: v.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder={String(min)}
              placeholderTextColor="#6B7280"
              maxLength={String(MAX_CREDITS).length}
              editable={inputs.inCorso}
              accessibilityLabel={t("masters.credits")}
              accessibilityHint={inputs.inCorso ? t("masters.creditsHint", { min: String(min) }) : t("masters.creditsHintOff")}
              className={`min-h-[44px] rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2.5 text-base font-semibold text-gray-900 dark:text-white ${inputs.inCorso ? "" : "opacity-50"}`}
              style={{ textAlign: "right", minWidth: 96 }}
            />
          </Field>
          <Field label={t("masters.inCorso")} hint={t("masters.inCorsoSub", { min: String(min) })}>
            <AppSwitch value={inputs.inCorso} onValueChange={(v) => set({ inCorso: v })} label={t("masters.inCorso")} />
          </Field>
        </View>

        {/* Score */}
        <View
          className="mt-3 rounded-2xl bg-astra-primary dark:bg-white/10 p-5"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${t("masters.score")} ${score == null ? t("masters.enterGpa") : fmt(score)}`}
        >
          <Text className="text-xs text-white/70">{t("masters.score")}</Text>
          <Text className="mt-1 text-4xl font-semibold text-white" style={{ fontVariant: ["tabular-nums"] }}>
            {score == null ? "—" : fmt(score)}
          </Text>
          <Text className="mt-1 text-xs text-white/70">
            {score != null
              ? t("masters.scoreOf110", { n: fmt((score * 110) / 30, 1) })
              : result.missing === "credits"
                ? t("masters.creditsNeeded")
                : t("masters.enterGpa")}
          </Text>
        </View>

        {/* Programmes */}
        {rows.length > 0 && (
          <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
            {rows.map((r, i) => (
              <ProgrammeRow key={r.programme.key} r={r} first={i === 0} fmt={fmt} tn={tn} />
            ))}
          </View>
        )}

        {/* How it works */}
        <View className="mt-3 overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
          <Pressable
            onPress={() => setHow((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: how }}
            className="min-h-[52px] flex-row items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-white/5"
          >
            <Text className="flex-1 text-base font-semibold text-gray-900 dark:text-white">{t("masters.howTitle")}</Text>
            <Icon name={how ? "chevron-up" : "chevron-down"} size={18} color="#6B7280" />
          </Pressable>
          {how &&
            HOW.map(([title, body]) => (
              <View key={title} className="border-t border-gray-100 dark:border-white/10 px-4 py-3">
                <Text accessibilityRole="header" className="text-[15px] font-semibold text-gray-900 dark:text-white">{t(title)}</Text>
                <Text className="mt-1 text-sm leading-5 text-gray-700 dark:text-gray-200">{t(body)}</Text>
              </View>
            ))}
        </View>

        <Text className="mt-6 text-center text-[11px] leading-4 text-gray-500 dark:text-white/60">{t("masters.disclaimer")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgrammeRow({
  r,
  first,
  fmt,
  tn,
}: {
  r: ProgrammeOutlook;
  first: boolean;
  fmt: (n: number, digits?: number) => string;
  tn: ReturnType<typeof useTn>;
}) {
  const t = useT();
  const c = STANDING[r.standing];
  const margin = r.margin == null ? null : fmt(Math.abs(r.margin));
  const marginText =
    margin == null
      ? null
      : t(r.standing === "above" ? "masters.marginAbove" : r.standing === "close" ? "masters.marginClose" : "masters.marginBelow", {
          n: margin,
        });
  const detail =
    r.lowest == null
      ? t("masters.noRoundData")
      : [
          t(r.admits === 1 ? "masters.lowestOne" : "masters.lowest", { n: fmt(r.lowest) }),
          r.median != null ? t("masters.median", { n: fmt(r.median) }) : null,
          tn("masters.admits", r.admits, { n: String(r.admits) }),
        ]
          .filter(Boolean)
          .join(" · ");
  const spoken = [r.programme.name, t(c.label), marginText, detail, r.lowData && r.admits > 0 ? t("masters.lowData") : null]
    .filter(Boolean)
    .join(". ");
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      className={`min-h-[56px] flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-gray-100 dark:border-white/10"}`}
    >
      <View className="flex-1">
        <Text className="text-[15px] font-medium text-gray-900 dark:text-white">{r.programme.name}</Text>
        {marginText && <Text className="mt-0.5 text-xs font-medium text-gray-700 dark:text-gray-200">{marginText}</Text>}
        <Text className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{detail}</Text>
        {r.lowData && r.admits > 0 && <Text className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{t("masters.lowData")}</Text>}
        {r.programme.selective && <Text className="mt-0.5 text-xs text-gray-500 dark:text-white/60">{t("masters.selective")}</Text>}
      </View>
      <View className={`rounded-full px-2.5 py-1 ${c.pill}`}>
        <Text chrome className={`text-xs font-semibold ${c.text}`}>{t(c.label)}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  hint,
  error,
  first,
  children,
}: {
  label: string;
  hint: string;
  error?: string | null;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View className={`px-4 py-3 ${first ? "" : "border-t border-gray-100 dark:border-white/10"}`}>
      <View className="min-h-[44px] flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-[15px] font-medium text-gray-900 dark:text-white">{label}</Text>
          <Text className="text-xs text-gray-600 dark:text-gray-300">{hint}</Text>
        </View>
        <View style={{ flexShrink: 0 }}>{children}</View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="mt-1.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The bachelor calculator's average, if the student has filled it in. Admissions
 * count the modules of an integrated exam one by one, so this is not the
 * (module-rounded) average the calculator shows.
 */
function useCalculatorAverage(): number | null {
  const [avg, setAvg] = useState<number | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync("calc.bachelor")
      .then((raw) => {
        if (!raw) return;
        const saved = loadSaved("bachelor", JSON.parse(raw));
        if (!saved) return;
        const average = admissionAverage(toState("bachelor", saved));
        if (average != null) setAvg(average);
      })
      .catch(() => {});
  }, []);
  return avg;
}
