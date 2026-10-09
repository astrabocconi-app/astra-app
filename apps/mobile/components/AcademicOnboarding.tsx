import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  Modal,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import type { AcademicCatalogueResponse } from "@astra/shared";
import { Icon, Spinner } from "./Icon";
import { Text } from "./AppText";
import { Chip } from "./Chip";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/auth-store";
import { useBootStore } from "../lib/boot-store";
import { useT, type TranslationKey } from "../lib/i18n";
import { announce } from "../lib/use-reduced-motion";
import { errorCode } from "../lib/api-errors";
import { TextField } from "./TextField";

type Programme = AcademicCatalogueResponse["programmes"][number];
type Step = "programme" | "year" | "track" | "class" | "done";

const BRAND = "#04107E";
const SKIPPED_KEY = "astra_onboarding_skipped";

const LEVEL_LABEL: Record<string, TranslationKey> = {
  BACHELOR: "onboarding.levelBachelor",
  MASTER_OF_SCIENCE: "onboarding.levelMaster",
  INTEGRATED_MASTER: "profile.levelIntegrated",
};

/** Tracks a student of this year can already choose (BIEF splits in year 2, say). */
const openTracks = (p: Programme | null, year: number | null) =>
  p && year ? p.tracks.filter((tr) => (tr.fromYear ?? 1) <= year) : [];

/** True while the on-screen keyboard is up. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * Asks a signed-in student for programme, year, track and class the first time
 * they land in the app without an academic profile. While they answer, the data
 * the other tabs need is fetched in the background, so the app is warm when
 * this closes.
 */
export function AcademicOnboarding() {
  const t = useT();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const keyboardOpen = useKeyboardOpen();
  const booting = useBootStore((s) => s.booting);
  // "Later" lives in the auth store, not in this component: if a second copy of
  // this sheet ever mounts it must not open on top of one the student closed.
  const closed = useAuthStore((s) => s.onboardingClosed);
  const closeSheet = useAuthStore((s) => s.closeOnboarding);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const needsProfile = Boolean(me.data && !me.data.academicProfile);

  // null until SecureStore answers, so the sheet never flashes for someone who skipped.
  const [skipped, setSkipped] = useState<boolean | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(SKIPPED_KEY)
      .then((v) => setSkipped(v === "1"))
      .catch(() => setSkipped(false));
  }, []);

  const [step, setStep] = useState<Step>("programme");
  const [level, setLevel] = useState("BACHELOR");
  const [query, setQuery] = useState("");
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every timer this sheet starts, so none can fire after the student has moved
  // on (or after the sheet is gone).
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const cancelTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => cancelTimers, []);

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
  const tracksHere = openTracks(programme, year);
  // The sequence for this programme and year. The track step only exists when a
  // track is open for the year; until a year is chosen, a programme that has any
  // tracks is counted as having that step.
  const steps: Step[] = [
    "programme",
    "year",
    ...(year ? (tracksHere.length ? (["track"] as const) : []) : programme?.tracks.length ? (["track"] as const) : []),
    ...(hasClasses ? (["class"] as const) : []),
  ];
  const total = programme ? steps.length : 3;
  const stepIndex = Math.max(1, steps.indexOf(step) + 1);

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

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  /** The step after `from`, for a year already chosen. */
  function nextAfter(from: "year" | "track", y: number, tr: string | null): Step | null {
    if (from === "year" && openTracks(programme, y).length) return "track";
    if (hasClasses) return "class";
    // Nothing more to ask: save now.
    void save(y, tr, null);
    return null;
  }

  function pickProgramme(p: Programme) {
    cancelTimers();
    setProgrammeId(p.id);
    setClassId(null);
    setTrackId(null);
    if (year && year > p.durationYears) setYear(null);
    // A beat so the selected row paints before the page moves.
    later(() => go("year"), 160);
  }

  function pickYear(y: number) {
    cancelTimers();
    setYear(y);
    // A track chosen for another year may not exist in this one.
    const keep = trackId && openTracks(programme, y).some((tr) => tr.id === trackId) ? trackId : null;
    setTrackId(keep);
    later(() => {
      const next = nextAfter("year", y, keep);
      if (next) go(next);
    }, 160);
  }

  function pickTrack(id: string) {
    if (!year) return;
    cancelTimers();
    setTrackId(id);
    later(() => {
      const next = nextAfter("track", year, id);
      if (next) go(next);
    }, 160);
  }

  async function save(studyYear: number, track: string | null, classGroupId: string | null) {
    if (!programme) return;
    setClassId(classGroupId);
    setSaving(true);
    setError(null);
    try {
      await api.academic.updateProfile({
        programmeId: programme.id,
        studyYear,
        trackId: track,
        classGroupId,
      });
      go("done");
      announce(t("onboarding.doneTitle"));
      // Close on a timer, not after the refetch: a cold API start used to keep
      // "You're all set" on screen for seconds, which read as a freeze. A screen
      // reader needs longer to say it.
      const reader = await AccessibilityInfo.isScreenReaderEnabled().catch(() => false);
      later(closeSheet, reader ? 3500 : 1200);
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["materials"] });
    } catch (e) {
      if (errorCode(e) === "TRACK_REQUIRED") {
        // The server wants a track we did not ask for (the catalogue moved on).
        go("track");
      } else {
        const message = t("onboarding.saveFailed");
        setError(message);
        announce(message);
      }
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    void SecureStore.setItemAsync(SKIPPED_KEY, "1").catch(() => {});
    closeSheet();
  }

  function back() {
    cancelTimers();
    const prev = steps[steps.indexOf(step) - 1];
    if (prev) go(prev);
  }

  const selectedClass = programme?.classGroups.find((c) => c.id === classId);
  const selectedTrack = programme?.tracks.find((tr) => tr.id === trackId);

  // The card is a fixed-height window onto a scrolling page. With the keyboard
  // up, or text scaled past 1.3x, it takes the whole screen so the list always
  // has room; otherwise it caps at 640pt.
  const roomy = keyboardOpen || fontScale > 1.3;

  const titleKey: TranslationKey =
    step === "programme"
      ? "onboarding.programmeTitle"
      : step === "year"
        ? "onboarding.yearTitle"
        : step === "track"
          ? "onboarding.trackTitle"
          : "onboarding.classTitle";
  const subKey: TranslationKey =
    step === "programme"
      ? "onboarding.programmeSub"
      : step === "year"
        ? "onboarding.yearSub"
        : step === "track"
          ? "onboarding.trackSub"
          : "onboarding.classSub";

  /** Title, subtitle and what has been chosen so far: the top of every step's page. */
  const intro = (
    <View className="px-6 pt-5">
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        className="text-2xl font-semibold text-gray-900 dark:text-white"
      >
        {t(titleKey)}
      </Text>
      {/* Hidden while typing: it is the first thing to go when room is short. */}
      {keyboardOpen && step === "programme" ? null : (
        <Text
          maxFontSizeMultiplier={1.4}
          className="mt-2 text-[15px] leading-5 text-gray-500 dark:text-gray-300"
        >
          {t(subKey)}
        </Text>
      )}

      {/* What's been chosen so far — tap to change it */}
      {step !== "programme" && programme ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          <Crumb label={programme.code} onPress={() => go("programme")} />
          {(step === "track" || step === "class") && year ? (
            <Crumb label={`${t("onboarding.yearWord")} ${year}`} onPress={() => go("year")} />
          ) : null}
          {step === "class" && selectedTrack ? (
            <Crumb label={selectedTrack.code} onPress={() => go("track")} />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    // Android back on the first step closes the sheet (like "Later"); further
    // in, it steps back.
    // A card over the dimmed app rather than a full-screen page.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={step === "programme" || step === "done" ? closeSheet : back}
    >
      {/* "padding" on Android too: edge-to-edge windows are not resized for the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          className="flex-1 justify-center bg-black/50 px-4"
          style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
        >
          <View
            className="overflow-hidden rounded-3xl bg-white dark:bg-astra-primary"
            style={roomy ? { flex: 1 } : { flex: 1, maxHeight: 640 }}
            accessibilityViewIsModal
          >
            {step === "done" ? (
              <View className="flex-1 items-center justify-center px-10">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
                  <Icon name="checkmark" size={30} color="#04107E" />
                </View>
                <Text
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.4}
                  className="mt-5 text-xl font-semibold text-gray-900 dark:text-white"
                >
                  {t("onboarding.doneTitle")}
                </Text>
                <Text className="mt-2 text-center text-gray-500 dark:text-gray-300">
                  {[
                    programme?.code,
                    year ? `${t("onboarding.yearWord")} ${year}` : null,
                    selectedTrack?.code,
                    selectedClass ? `${t("profile.class")} ${selectedClass.code}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              </View>
            ) : (
              <>
                {/* Progress */}
                <View className="px-6 pt-4">
                  <View className="min-h-[44px] flex-row items-center justify-between">
                    {step !== "programme" ? (
                      <Pressable
                        onPress={back}
                        hitSlop={12}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.back")}
                        accessibilityState={{ disabled: saving }}
                        className="-ml-2 h-11 w-11 items-center justify-center"
                      >
                        <Icon name="chevron-back" size={24} color={BRAND} />
                      </Pressable>
                    ) : (
                      <View />
                    )}
                    <Text
                      maxFontSizeMultiplier={1.3}
                      className="text-xs text-gray-600 dark:text-white/70"
                    >
                      {t("onboarding.step", { current: String(stepIndex), total: String(total) })}
                    </Text>
                  </View>
                  <View className="mt-1 flex-row gap-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {Array.from({ length: total }, (_, i) => (
                      <View
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < stepIndex ? "bg-astra-primary dark:bg-white" : "bg-gray-200 dark:bg-white/15"}`}
                      />
                    ))}
                  </View>
                </View>

                {/* No Reanimated layout animations in here: inside a Modal on iOS
                    an entering animation can fail to start, leaving the step
                    invisible (the blank card testers got stuck on), and an
                    exiting one can leave a dead view that swallows taps. */}
                <View key={step} style={{ flex: 1 }}>
                  {step === "programme" ? (
                    <FlatList
                      data={catalogue.data ? list : []}
                      keyExtractor={(p) => p.id}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode="on-drag"
                      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, flexGrow: 1 }}
                      ListHeaderComponent={
                        <View className="-mx-4">
                          {intro}
                          {catalogue.isError || catalogue.isLoading ? null : (
                            <View className="px-6 pt-5">
                              <View className="min-h-[48px] flex-row items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/10 px-3">
                                <Icon name="search" size={16} color="#6B7280" />
                                <TextField
                                  value={query}
                                  onChangeText={setQuery}
                                  placeholder={t("onboarding.search")}
                                  accessibilityLabel={t("onboarding.search")}
                                  placeholderTextColor="#6B7280"
                                  autoCorrect={false}
                                  autoCapitalize="none"
                                  returnKeyType="search"
                                  className="flex-1 py-3 text-[15px] text-gray-900 dark:text-white"
                                />
                              </View>
                              {!query && levels.length > 1 && !keyboardOpen ? (
                                <View className="mt-3 flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                                  {levels.map((l) => (
                                    <Chip
                                      key={l}
                                      label={LEVEL_LABEL[l] ? t(LEVEL_LABEL[l]) : l}
                                      active={level === l}
                                      onPress={() => setLevel(l)}
                                    />
                                  ))}
                                </View>
                              ) : null}
                            </View>
                          )}
                          <View className="h-2.5" />
                        </View>
                      }
                      ListEmptyComponent={
                        catalogue.isError ? (
                          <View className="items-center gap-4 px-8 py-8">
                            <Text
                              accessibilityRole="alert"
                              accessibilityLiveRegion="polite"
                              className="text-center text-gray-600 dark:text-gray-300"
                            >
                              {t("onboarding.loadFailed")}
                            </Text>
                            <Pressable
                              onPress={() => catalogue.refetch()}
                              accessibilityRole="button"
                              className="min-h-[44px] justify-center rounded-xl bg-astra-primary dark:bg-white/15 px-6 py-3 active:opacity-90"
                            >
                              <Text chrome className="font-semibold text-white">
                                {t("onboarding.retry")}
                              </Text>
                            </Pressable>
                            <Pressable onPress={closeSheet} hitSlop={8} accessibilityRole="button" className="min-h-[44px] justify-center">
                              <Text chrome className="text-sm text-gray-600 dark:text-gray-300">
                                {t("onboarding.later")}
                              </Text>
                            </Pressable>
                          </View>
                        ) : catalogue.isLoading ? (
                          <View className="items-center py-10">
                            <Spinner />
                          </View>
                        ) : (
                          <Text className="px-2 py-8 text-center text-gray-600 dark:text-white/70">
                            {t("onboarding.noResults", { q: query.trim() })}
                          </Text>
                        )
                      }
                      ListFooterComponent={
                        catalogue.data ? (
                          <Pressable
                            onPress={skip}
                            accessibilityRole="button"
                            className="min-h-[44px] items-center justify-center pt-1"
                            hitSlop={8}
                          >
                            <Text chrome className="text-[13px] text-gray-600 underline dark:text-white/70">
                              {t("onboarding.skip")}
                            </Text>
                          </Pressable>
                        ) : null
                      }
                      renderItem={({ item }) => {
                        const on = item.id === programmeId;
                        return (
                          <Pressable
                            onPress={() => pickProgramme(item)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            className={`min-h-[52px] flex-row items-center gap-3 rounded-xl px-3 py-3.5 ${
                              on
                                ? "bg-astra-primary dark:bg-white"
                                : "active:bg-astra-light dark:active:bg-white/10"
                            }`}
                          >
                            <Text
                              maxFontSizeMultiplier={1.3}
                              className={`w-[68px] text-[15px] font-semibold ${on ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                            >
                              {item.code}
                            </Text>
                            <Text
                              className={`flex-1 text-[15px] leading-5 ${on ? "text-white/90 dark:text-astra-primary" : "text-gray-700 dark:text-gray-200"}`}
                              numberOfLines={3}
                            >
                              {item.name}
                              {item.legacy ? t("profile.legacySuffix") : ""}
                            </Text>
                          </Pressable>
                        );
                      }}
                    />
                  ) : null}

                  {step === "year" && programme ? (
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                      {intro}
                      <View className="flex-row flex-wrap gap-2.5 px-6 pt-7" accessibilityRole="radiogroup">
                        {Array.from({ length: programme.durationYears }, (_, i) => i + 1).map((y) => {
                          const on = y === year;
                          return (
                            <Pressable
                              key={y}
                              onPress={() => pickYear(y)}
                              disabled={saving}
                              accessibilityRole="radio"
                              accessibilityLabel={`${t("onboarding.yearWord")} ${y}`}
                              accessibilityState={{ selected: on, checked: on, disabled: saving }}
                              className={`min-h-[56px] min-w-[52px] flex-1 items-center justify-center rounded-2xl ${
                                on
                                  ? "bg-astra-primary dark:bg-white"
                                  : "bg-astra-light dark:bg-white/10 active:opacity-80"
                              }`}
                            >
                              <Text
                                chrome
                                className={`text-lg font-semibold ${on ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                                style={{ fontVariant: ["tabular-nums"] }}
                              >
                                {y}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  ) : null}

                  {step === "track" && programme ? (
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                      {intro}
                      <View className="gap-2 px-6 pt-6" accessibilityRole="radiogroup">
                        {tracksHere.map((tr) => {
                          const on = tr.id === trackId;
                          return (
                            <Pressable
                              key={tr.id}
                              onPress={() => pickTrack(tr.id)}
                              disabled={saving}
                              accessibilityRole="radio"
                              accessibilityLabel={tr.name}
                              accessibilityState={{ selected: on, checked: on, disabled: saving }}
                              className={`min-h-[56px] flex-row items-center gap-3 rounded-2xl px-4 py-3.5 ${
                                on
                                  ? "bg-astra-primary dark:bg-white"
                                  : "bg-astra-light dark:bg-white/10 active:opacity-80"
                              }`}
                            >
                              <Text
                                maxFontSizeMultiplier={1.3}
                                className={`w-[56px] text-[15px] font-bold ${on ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                              >
                                {tr.code}
                              </Text>
                              <Text
                                className={`flex-1 text-[15px] leading-5 ${on ? "text-white dark:text-astra-primary" : "text-gray-700 dark:text-gray-200"}`}
                              >
                                {tr.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  ) : null}

                  {step === "class" && programme ? (
                    <FlatList
                      data={programme.classGroups}
                      keyExtractor={(c) => c.id}
                      numColumns={4}
                      columnWrapperStyle={{ gap: 10 }}
                      ListHeaderComponent={<View className="-mx-6">{intro}<View className="h-6" /></View>}
                      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 10 }}
                      renderItem={({ item }) => {
                        const on = item.id === classId;
                        return (
                          <Pressable
                            onPress={() => year && save(year, trackId, item.id)}
                            disabled={saving}
                            accessibilityRole="button"
                            accessibilityLabel={`${t("profile.class")} ${item.code}`}
                            accessibilityState={{ selected: on, disabled: saving }}
                            className={`min-h-[48px] flex-1 items-center justify-center rounded-2xl ${
                              on
                                ? "bg-astra-primary dark:bg-white"
                                : "bg-astra-light dark:bg-white/10 active:opacity-80"
                            }`}
                            style={{ aspectRatio: 1, maxWidth: "23%" }}
                          >
                            <Text
                              chrome
                              className={`text-base font-semibold ${on ? "text-white dark:text-astra-primary" : "text-astra-primary dark:text-white"}`}
                            >
                              {item.code}
                            </Text>
                          </Pressable>
                        );
                      }}
                      ListFooterComponent={
                        <Pressable
                          onPress={() => year && save(year, trackId, null)}
                          disabled={saving}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: saving }}
                          className="mt-2 min-h-[48px] items-center justify-center rounded-2xl border border-gray-100 dark:border-white/10 py-3.5 active:bg-gray-50 dark:active:bg-white/5"
                        >
                          <Text chrome className="text-[15px] font-semibold text-gray-600 dark:text-gray-200">
                            {t("onboarding.notSure")}
                          </Text>
                        </Pressable>
                      }
                    />
                  ) : null}
                </View>

                {saving || error ? (
                  <View
                    className="flex-row items-center justify-center gap-2 px-6 pb-4 pt-2"
                    accessibilityLiveRegion="polite"
                  >
                    {saving ? <Spinner /> : null}
                    <Text
                      accessibilityRole={error ? "alert" : undefined}
                      className={`text-center text-sm ${error ? "text-red-700 dark:text-red-300" : "text-gray-600 dark:text-gray-300"}`}
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
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("onboarding.changeHint")}
      className="min-h-[34px] flex-row items-center gap-1.5 rounded-full border border-astra-primary/25 dark:border-white/30 px-3 py-1 active:bg-astra-light dark:active:bg-white/10"
    >
      <Text chrome className="text-[13px] font-bold text-astra-primary dark:text-white">
        {label}
      </Text>
      <Icon name="pencil" size={11} color={BRAND} />
    </Pressable>
  );
}
