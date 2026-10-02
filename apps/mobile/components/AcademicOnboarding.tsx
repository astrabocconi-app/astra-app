import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import type { AcademicCatalogueResponse } from "@astra/shared";
import { Icon, Spinner } from "./Icon";
import { api } from "../lib/api";
import { useBootStore } from "../lib/boot-store";
import { useT, type TranslationKey } from "../lib/i18n";
import { TextField } from "./TextField";

type Programme = AcademicCatalogueResponse["programmes"][number];
type Step = "programme" | "year" | "class" | "done";

const BRAND = "#04107E";
const SKIPPED_KEY = "astra_onboarding_skipped";

const LEVEL_LABEL: Record<string, TranslationKey> = {
  BACHELOR: "onboarding.levelBachelor",
  MASTER_OF_SCIENCE: "onboarding.levelMaster",
  INTEGRATED_MASTER: "profile.levelIntegrated",
};

/**
 * Asks a signed-in student for programme, year and class the first time they
 * land in the app without an academic profile. While they answer, the data the
 * other tabs need is fetched in the background, so the app is warm when this
 * closes.
 */
export function AcademicOnboarding() {
  const t = useT();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const booting = useBootStore((s) => s.booting);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const needsProfile = Boolean(me.data && !me.data.academicProfile);

  // null until SecureStore answers, so the sheet never flashes for someone who skipped.
  const [skipped, setSkipped] = useState<boolean | null>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync(SKIPPED_KEY)
      .then((v) => setSkipped(v === "1"))
      .catch(() => setSkipped(false));
  }, []);

  const [step, setStep] = useState<Step>("programme");
  const [forward, setForward] = useState(true);
  const [level, setLevel] = useState("BACHELOR");
  const [query, setQuery] = useState("");
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = !closed && skipped === false && !booting && (needsProfile || step === "done");

  const catalogue = useQuery({
    queryKey: ["academic-catalogue"],
    queryFn: () => api.academic.catalogue(),
    enabled: needsProfile,
  });

  const warmed = useRef(false);
  useEffect(() => {
    if (!visible || warmed.current) return;
    warmed.current = true;
    void qc.prefetchQuery({ queryKey: ["events"], queryFn: () => api.events.list() });
    void qc.prefetchQuery({ queryKey: ["partners"], queryFn: () => api.partners.list() });
    void qc.prefetchQuery({ queryKey: ["rewards"], queryFn: () => api.rewards.list() });
    void qc.prefetchQuery({ queryKey: ["news"], queryFn: () => api.news.list() });
  }, [visible, qc]);

  const programmes = catalogue.data?.programmes ?? [];
  const programme = programmes.find((p) => p.id === programmeId) ?? null;
  const hasClasses = Boolean(programme?.classGroups.length);
  const total = hasClasses || !programme ? 3 : 2;
  const stepIndex = step === "programme" ? 1 : step === "year" ? 2 : 3;

  const levels = useMemo(() => [...new Set(programmes.map((p) => p.level))], [programmes]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? programmes.filter(
          (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
        )
      : programmes.filter((p) => p.level === level);
    // Current programmes first; legacy ones are for students finishing an old plan.
    return [...matches].sort(
      (a, b) => Number(a.legacy) - Number(b.legacy) || a.code.localeCompare(b.code)
    );
  }, [programmes, query, level]);

  function go(next: Step, isForward = true) {
    setForward(isForward);
    setError(null);
    setStep(next);
  }

  function pickProgramme(p: Programme) {
    setProgrammeId(p.id);
    setClassId(null);
    if (year && year > p.durationYears) setYear(null);
    // A beat so the selected row paints before the page moves.
    setTimeout(() => go("year"), 160);
  }

  function pickYear(y: number) {
    setYear(y);
    if (hasClasses) setTimeout(() => go("class"), 160);
    else void save(y, null);
  }

  async function save(studyYear: number, classGroupId: string | null) {
    if (!programme) return;
    setClassId(classGroupId);
    setSaving(true);
    setError(null);
    try {
      await api.academic.updateProfile({
        programmeId: programme.id,
        studyYear,
        trackId: null,
        classGroupId,
      });
      go("done");
      // Close on a timer, not after the refetch: a cold API start used to keep
      // "You're all set" on screen for seconds, which read as a freeze.
      setTimeout(() => setClosed(true), 1200);
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["materials"] });
    } catch {
      setError(t("onboarding.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    void SecureStore.setItemAsync(SKIPPED_KEY, "1");
    setClosed(true);
  }

  function back() {
    if (step === "class") go("year", false);
    else if (step === "year") go("programme", false);
  }

  const entering = (forward ? FadeInRight : FadeInLeft).duration(260);
  const selectedClass = programme?.classGroups.find((c) => c.id === classId);

  return (
    // Android back on the first step closes the sheet (like "Later"); further
    // in, it steps back.
    // A card over the dimmed app rather than a full-screen page. It grows up to
    // 640pt and shrinks when the keyboard is up, so the list and its last row
    // stay reachable on small phones.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={step === "programme" ? () => setClosed(true) : back}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          className="flex-1 justify-center bg-black/50 px-4"
          style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
        >
          <View
            className="overflow-hidden rounded-3xl bg-white dark:bg-astra-primary"
            style={{ flex: 1, maxHeight: 640 }}
          >
            {step === "done" ? (
              <View className="flex-1 items-center justify-center px-10">
                <Animated.View
                  entering={FadeIn.duration(260)}
                  className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10"
                >
                  <Icon name="checkmark" size={30} color="#04107E" />
                </Animated.View>
                <Animated.Text
                  entering={FadeInRight.delay(120).duration(260)}
                  className="mt-5 text-xl font-semibold text-gray-900 dark:text-white"
                >
                  {t("onboarding.doneTitle")}
                </Animated.Text>
                <Animated.Text
                  entering={FadeInRight.delay(200).duration(260)}
                  className="mt-2 text-center text-gray-500 dark:text-gray-300"
                >
                  {[
                    programme?.code,
                    year ? `${t("onboarding.yearWord")} ${year}` : null,
                    selectedClass ? `${t("profile.class")} ${selectedClass.code}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Animated.Text>
              </View>
            ) : (
              <>
                {/* Progress */}
                <View className="px-6 pt-4">
                  <View className="h-9 flex-row items-center justify-between">
                    {step !== "programme" ? (
                      <Pressable
                        onPress={back}
                        hitSlop={12}
                        disabled={saving}
                        className="-ml-1 flex-row items-center"
                      >
                        <Icon name="chevron-back" size={24} color={BRAND} />
                      </Pressable>
                    ) : (
                      <View />
                    )}
                    <Text className="text-xs text-gray-400 dark:text-white/60">
                      {t("onboarding.step", { current: String(stepIndex), total: String(total) })}
                    </Text>
                  </View>
                  <View className="mt-2 flex-row gap-1.5">
                    {Array.from({ length: total }, (_, i) => (
                      <View
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < stepIndex ? "bg-astra-primary dark:bg-white" : "bg-gray-200 dark:bg-white/15"}`}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  {/* Entering only: an exiting layout animation inside a Modal can
                  leave a dead view over the sheet on iOS and swallow every tap. */}
                  <Animated.View key={step} entering={entering} className="flex-1">
                    <View className="px-6 pt-7">
                      <Text className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {t(
                          step === "programme"
                            ? "onboarding.programmeTitle"
                            : step === "year"
                              ? "onboarding.yearTitle"
                              : "onboarding.classTitle"
                        )}
                      </Text>
                      <Text className="mt-2 text-[15px] leading-5 text-gray-500 dark:text-gray-300">
                        {t(
                          step === "programme"
                            ? "onboarding.programmeSub"
                            : step === "year"
                              ? "onboarding.yearSub"
                              : "onboarding.classSub"
                        )}
                      </Text>

                      {/* What's been chosen so far — tap to change it */}
                      {step !== "programme" && programme ? (
                        <View className="mt-4 flex-row flex-wrap gap-2">
                          <Crumb label={programme.code} onPress={() => go("programme", false)} />
                          {step === "class" && year ? (
                            <Crumb
                              label={`${t("onboarding.yearWord")} ${year}`}
                              onPress={() => go("year", false)}
                            />
                          ) : null}
                        </View>
                      ) : null}
                    </View>

                    {step === "programme" &&
                      (catalogue.isError ? (
                        <View className="flex-1 items-center justify-center gap-4 px-10">
                          <Text className="text-center text-gray-500 dark:text-gray-300">
                            {t("onboarding.loadFailed")}
                          </Text>
                          <Pressable
                            onPress={() => catalogue.refetch()}
                            className="rounded-xl bg-astra-primary dark:bg-white/15 px-6 py-3 active:opacity-90"
                          >
                            <Text className="font-semibold text-white">
                              {t("onboarding.retry")}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => setClosed(true)} hitSlop={8}>
                            <Text className="text-sm text-gray-500 dark:text-gray-300">
                              {t("onboarding.later")}
                            </Text>
                          </Pressable>
                        </View>
                      ) : catalogue.isLoading ? (
                        <View className="flex-1 items-center justify-center">
                          <Spinner />
                        </View>
                      ) : (
                        <>
                          <View className="px-6 pt-5">
                            <View className="flex-row items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/10 px-3">
                              <Icon name="search" size={16} color="#9CA3AF" />
                              <TextField
                                value={query}
                                onChangeText={setQuery}
                                placeholder={t("onboarding.search")}
                                placeholderTextColor="#9CA3AF"
                                autoCorrect={false}
                                autoCapitalize="none"
                                className="flex-1 py-3 text-[15px] text-gray-900 dark:text-white"
                              />
                            </View>
                            {!query && levels.length > 1 ? (
                              <View className="mt-3 flex-row flex-wrap gap-2">
                                {levels.map((l) => (
                                  <Pressable
                                    key={l}
                                    onPress={() => setLevel(l)}
                                    hitSlop={{ top: 6, bottom: 6 }}
                                    className={`rounded-full px-3.5 py-2 ${
                                      level === l
                                        ? "bg-astra-primary dark:bg-white"
                                        : "bg-gray-100 dark:bg-white/10"
                                    }`}
                                  >
                                    <Text
                                      className={`text-[13px] font-medium ${
                                        level === l
                                          ? "text-white dark:text-astra-primary"
                                          : "text-gray-700 dark:text-gray-200"
                                      }`}
                                    >
                                      {LEVEL_LABEL[l] ? t(LEVEL_LABEL[l]) : l}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                          </View>

                          <FlatList
                            data={list}
                            keyExtractor={(p) => p.id}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={{
                              paddingHorizontal: 16,
                              paddingTop: 10,
                              paddingBottom: 12,
                            }}
                            ListEmptyComponent={
                              <Text className="px-2 py-8 text-center text-gray-400 dark:text-white/50">
                                {t("onboarding.noResults", { q: query.trim() })}
                              </Text>
                            }
                            renderItem={({ item }) => {
                              const on = item.id === programmeId;
                              return (
                                <Pressable
                                  onPress={() => pickProgramme(item)}
                                  className={`flex-row items-center gap-3 rounded-xl px-3 py-3.5 ${
                                    on
                                      ? "bg-astra-primary dark:bg-white"
                                      : "active:bg-astra-light dark:active:bg-white/10"
                                  }`}
                                >
                                  <Text
                                    className={`w-[68px] text-[15px] font-semibold ${on ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                  >
                                    {item.code}
                                  </Text>
                                  <Text
                                    className={`flex-1 text-[15px] leading-5 ${on ? "text-white/90 dark:text-astra-primary" : "text-gray-700 dark:text-gray-200"}`}
                                    numberOfLines={2}
                                  >
                                    {item.name}
                                    {item.legacy ? t("profile.legacySuffix") : ""}
                                  </Text>
                                </Pressable>
                              );
                            }}
                          />
                          <Pressable onPress={skip} className="items-center pb-3 pt-1" hitSlop={8}>
                            <Text className="text-[13px] text-gray-400 underline dark:text-white/50">
                              {t("onboarding.skip")}
                            </Text>
                          </Pressable>
                        </>
                      ))}

                    {step === "year" && programme ? (
                      <View className="flex-row gap-2.5 px-6 pt-7">
                        {Array.from({ length: programme.durationYears }, (_, i) => i + 1).map(
                          (y) => {
                            const on = y === year;
                            return (
                              <Pressable
                                key={y}
                                onPress={() => pickYear(y)}
                                disabled={saving}
                                accessibilityLabel={`${t("onboarding.yearWord")} ${y}`}
                                className={`h-14 flex-1 items-center justify-center rounded-2xl ${
                                  on
                                    ? "bg-astra-primary dark:bg-white"
                                    : "bg-astra-light dark:bg-white/10 active:opacity-80"
                                }`}
                              >
                                <Text
                                  className={`text-lg font-semibold ${on ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                                  style={{ fontVariant: ["tabular-nums"] }}
                                >
                                  {y}
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </View>
                    ) : null}

                    {step === "class" && programme ? (
                      <FlatList
                        data={programme.classGroups}
                        keyExtractor={(c) => c.id}
                        numColumns={4}
                        columnWrapperStyle={{ gap: 10 }}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, gap: 10 }}
                        renderItem={({ item }) => {
                          const on = item.id === classId;
                          return (
                            <Pressable
                              onPress={() => year && save(year, item.id)}
                              disabled={saving}
                              className={`flex-1 items-center justify-center rounded-2xl ${
                                on
                                  ? "bg-astra-primary dark:bg-white"
                                  : "bg-astra-light dark:bg-white/10 active:opacity-80"
                              }`}
                              style={{ aspectRatio: 1, maxWidth: "23%" }}
                            >
                              <Text
                                className={`text-base font-semibold ${on ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                              >
                                {item.code}
                              </Text>
                            </Pressable>
                          );
                        }}
                        ListFooterComponent={
                          <Pressable
                            onPress={() => year && save(year, null)}
                            disabled={saving}
                            className="mt-2 items-center rounded-2xl border border-gray-100 dark:border-white/10 py-3.5 active:bg-gray-50 dark:active:bg-white/5"
                          >
                            <Text className="text-[15px] font-semibold text-gray-600 dark:text-gray-200">
                              {t("onboarding.notSure")}
                            </Text>
                          </Pressable>
                        }
                      />
                    ) : null}
                  </Animated.View>
                </View>

                {saving || error ? (
                  <View className="flex-row items-center justify-center gap-2 px-6 pb-4 pt-2">
                    {saving ? <Spinner /> : null}
                    <Text
                      className={`text-center text-sm ${error ? "text-red-600" : "text-gray-500 dark:text-gray-300"}`}
                    >
                      {error ?? t("onboarding.saving")}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Crumb({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-full border border-astra-primary/25 dark:border-white/30 px-3 py-1 active:bg-astra-light dark:active:bg-white/10"
    >
      <Text className="text-[13px] font-bold text-astra-primary dark:text-white">{label}</Text>
      <Icon name="pencil" size={11} color={BRAND} />
    </Pressable>
  );
}
