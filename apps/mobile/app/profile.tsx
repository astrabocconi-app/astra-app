import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { MeResponse } from "@astra/shared";
import { Icon, Spinner } from "../components/Icon";
import { NavRow } from "../components/NavRow";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { SegmentedToggle } from "../components/SegmentedToggle";
import { api } from "../lib/api";
import { clearToken } from "../lib/session";
import { sendTestNotification } from "../lib/push";
import { clearLegacyAcademicProfile, loadLegacyAcademicProfile } from "../lib/profile-store";
import { useLanguageStore } from "../lib/language-store";
import { useT } from "../lib/i18n";
import { TextField } from "../components/TextField";

type Picker = "programme" | "track" | "year" | "class" | null;

/** Sentinel row in the track/class sheets — both are optional, so both clear. */
const CLEAR = "__clear__";

/** Programme sheet sections, in the order a student scans for theirs. */
const LEVEL_SECTIONS = [
  { level: "BACHELOR", label: "profile.levelBachelor" },
  { level: "INTEGRATED_MASTER", label: "profile.levelIntegrated" },
  { level: "MASTER_OF_SCIENCE", label: "profile.levelMsc" },
] as const;

type SheetRow = { header: string } | { value: string; label: string; sub?: string };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
    retry: false,
  });
  const catalogue = useQuery({
    queryKey: ["academic-catalogue"],
    queryFn: () => api.academic.catalogue(),
    retry: false,
  });
  const { language, setLanguage } = useLanguageStore();
  const t = useT();
  const [picker, setPicker] = useState<Picker>(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const migrationStarted = useRef(false);

  // One-time migration from the former SecureStore-only course/year selection.
  useEffect(() => {
    if (migrationStarted.current || !data || data.academicProfile || !catalogue.data) {
      return;
    }
    migrationStarted.current = true;
    void (async () => {
      const legacy = await loadLegacyAcademicProfile();
      const programme = catalogue.data.programmes.find(
        (item) =>
          item.code === legacy.programmeCode ||
          item.name === legacy.programmeCode ||
          legacy.programmeCode?.includes(item.name)
      );
      if (!programme) return;
      await api.academic.updateProfile({
        programmeId: programme.id,
        studyYear: Math.min(legacy.studyYear ?? 1, programme.durationYears),
        trackId: null,
        classGroupId: null,
      });
      await clearLegacyAcademicProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["materials"] }),
      ]);
    })().catch(() => {
      migrationStarted.current = false;
    });
  }, [catalogue.data, data, queryClient]);

  async function signOut() {
    await clearToken();
    queryClient.clear();
    router.replace("/");
  }

  /**
   * Deleting is irreversible, so it asks twice: the first alert explains what
   * goes, the second is the point of no return.
   */
  function confirmDelete() {
    Alert.alert(
      t("profile.deleteAccountTitle"),
      t("profile.deleteAccountBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.deleteAccountContinue"),
          style: "destructive",
          onPress: () =>
            Alert.alert(t("profile.deleteAccountFinalTitle"), t("profile.deleteAccountFinalBody"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("profile.deleteAccountConfirm"),
                style: "destructive",
                onPress: deleteAccount,
              },
            ]),
        },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api.deleteAccount();
      // The account is gone; drop the token and every cached response with it.
      await clearToken();
      queryClient.clear();
      router.replace("/");
    } catch {
      setDeleting(false);
      Alert.alert(
        t("profile.deleteAccountFailedTitle"),
        t("profile.deleteAccountFailedBody"),
      );
    }
  }

  const academic = data?.academicProfile ?? null;
  const selectedProgramme = catalogue.data?.programmes.find(
    (item) => item.id === academic?.programme.id
  );
  // Tracks only open from a given year (BIEF splits into Economics / Finance
  // in year 2), so the sheet and the row only offer what fits the year.
  const studyYear = academic?.studyYear ?? 1;
  // `?? 1`: an API from before fromYear existed sends tracks without it.
  const tracksForYear = selectedProgramme?.tracks.filter((item) => (item.fromYear ?? 1) <= studyYear) ?? [];

  function programmeRows(): SheetRow[] {
    const q = search.trim().toLowerCase();
    const all = (catalogue.data?.programmes ?? []).filter(
      (item) => !q || item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    );
    const groups = [
      ...LEVEL_SECTIONS.map((section) => ({
        label: t(section.label),
        items: all.filter((item) => !item.legacy && item.level === section.level),
      })),
      // Legacy programmes, or a level the list above doesn't know, go last.
      {
        label: t("profile.levelLegacy"),
        items: all.filter(
          (item) => item.legacy || !LEVEL_SECTIONS.some((section) => section.level === item.level)
        ),
      },
    ];
    return groups.flatMap((g) =>
      g.items.length
        ? [{ header: g.label }, ...g.items.map((item) => ({ value: item.id, label: item.code, sub: item.name }))]
        : []
    );
  }

  const pickerOptions: SheetRow[] =
    picker === "programme"
      ? programmeRows()
      : picker === "track"
        ? [
            { value: CLEAR, label: t("profile.noTrack") },
            ...tracksForYear.map((item) => ({ value: item.id, label: item.name, sub: item.code })),
          ]
      : picker === "year"
        ? Array.from({ length: selectedProgramme?.durationYears ?? 0 }, (_, index) => ({
            value: String(index + 1),
            label: `${t("profile.year")} ${index + 1}`,
          }))
        : [
            { value: CLEAR, label: t("profile.noClass") },
            ...(selectedProgramme?.classGroups.map((item) => ({
              value: item.id,
              label: `${t("profile.class")} ${item.code}`,
            })) ?? []),
          ];
  const currentValue =
    picker === "programme"
      ? academic?.programme.id
      : picker === "track"
        ? (academic?.track?.id ?? CLEAR)
      : picker === "year"
        ? String(academic?.studyYear ?? "")
        : (academic?.classGroup?.id ?? CLEAR);

  function closePicker() {
    setPicker(null);
    setSearch("");
  }

  async function choose(value: string) {
    if (!catalogue.data) return;
    const current = picker;
    const programme =
      current === "programme"
        ? catalogue.data.programmes.find((item) => item.id === value)
        : selectedProgramme;
    if (!programme) return;

    // Changing programme invalidates the track and class, which belong to it.
    const cleared = value === CLEAR;
    const nextYear =
      current === "year"
        ? Number(value)
        : Math.min(academic?.studyYear ?? 1, programme.durationYears);
    const keptTrack = programme.tracks.find((item) => item.id === academic?.track?.id);
    const nextTrackId =
      current === "track"
        ? (cleared ? null : value)
        : current === "programme"
          ? null
          : // A year change can land before the track opens; drop it then.
            keptTrack && (keptTrack.fromYear ?? 1) <= nextYear
            ? keptTrack.id
            : null;
    const nextClassId =
      current === "class"
        ? (cleared ? null : value)
        : current === "programme"
          ? null
          : (academic?.classGroup?.id ?? null);

    // Move on first. Waiting for the write and the refetches before dismissing
    // made the sheet sit there for seconds and feel broken. Picking a programme
    // leads straight to the year, and a year that opens tracks leads to the
    // track, so a new student fills the whole thing in one go.
    const tracksOpen = programme.tracks.some((item) => (item.fromYear ?? 1) <= nextYear);
    setSearch("");
    setPicker(
      current === "programme"
        ? "year"
        : current === "year" && tracksOpen && !nextTrackId
          ? "track"
          : null
    );

    // Then paint the new selection immediately. Without this the row kept
    // showing the OLD value until the refetch came back — you tapped "Year 2"
    // and the row still said "Year 1" for a beat, which is what made these
    // pickers feel broken. The write is confirmed by the refetch below.
    const previous = queryClient.getQueryData<MeResponse>(["me"]);
    const { tracks, classGroups, ...programmeSummary } = programme;
    queryClient.setQueryData<MeResponse>(["me"], (old) =>
      old
        ? {
            ...old,
            academicProfile: {
              programme: programmeSummary,
              catalogue: {
                id: catalogue.data.id,
                academicYear: catalogue.data.academicYear,
                version: catalogue.data.version,
                sourceUrl: catalogue.data.sourceUrl,
              },
              studyYear: nextYear,
              track: tracks.find((item) => item.id === nextTrackId) ?? null,
              classGroup: classGroups.find((item) => item.id === nextClassId) ?? null,
              updatedAt: new Date().toISOString(),
            },
          }
        : old,
    );

    try {
      await api.academic.updateProfile({
        programmeId: programme.id,
        studyYear: nextYear,
        trackId: nextTrackId,
        classGroupId: nextClassId,
      });
    } catch {
      // Put the old selection back rather than leaving a value on screen that
      // was never actually saved.
      if (previous) queryClient.setQueryData(["me"], previous);
      Alert.alert(
        t("profile.saveFailedTitle"),
        t("profile.saveFailedBody"),
      );
    } finally {
      // Refresh in the background — the sheet is already gone.
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      {/* Reached from the Home header rather than a tab, so it carries its own
          back affordance like the other pushed screens. */}
      <ScreenHeader title={t("tabs.profile")} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : error || !data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => refetch() }}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
        >
          <View className="items-center gap-2 pt-4">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-astra-light dark:bg-white/10">
              <Icon name="person" size={36} color="#04107E" />
            </View>
            <Text className="text-xl font-semibold text-gray-900 dark:text-white">
              {data.name?.split(" ")[0] ?? t("profile.student")}
            </Text>
            {/* Programme · year · class shown next to the name once selected */}
            {academic ? (
              <Text className="text-sm text-gray-500 dark:text-gray-300">
                {[
                  academic.programme.code,
                  academic.track?.code,
                  `${t("profile.year")} ${academic.studyYear}`,
                  academic.classGroup ? `${t("profile.class")} ${academic.classGroup.code}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : (
              <Text className="text-sm text-gray-400 dark:text-white/60">{t("profile.addAcademicInfo")}</Text>
            )}
          </View>

          {/* Academic selection drives Materials. */}
          <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
            {t("profile.academic")}
          </Text>
          <View className="gap-2">
            <NavRow
              icon="menu-book"
              eyebrow={t("profile.programme")}
              title={academic ? academic.programme.code : t("profile.selectProgramme")}
              subtitle={academic?.programme.name}
              onPress={() => setPicker("programme")}
            />

            {tracksForYear.length ? (
              <NavRow
                icon="call-split"
                eyebrow={t("profile.track")}
                title={academic?.track?.name ?? t("profile.selectTrack")}
                onPress={() => setPicker("track")}
              />
            ) : null}

            {/* Year needs a programme first (it bounds how many years exist), so
                without one the row is visibly disabled rather than a tap that
                silently does nothing. */}
            <NavRow
              icon="calendar-today"
              eyebrow={t("profile.year")}
              title={academic ? `${t("profile.year")} ${academic.studyYear}` : t("profile.selectYearProgrammeFirst")}
              disabled={!academic}
              onPress={() => setPicker("year")}
            />

            {/* Same for class: some programmes publish no class groups at all, and
                the row said "awaiting" while still looking tappable. Note class is
                never used to filter Materials, so leaving it unset costs a student
                nothing. */}
            <NavRow
              icon="people-outline"
              eyebrow={t("profile.class")}
              title={
                academic?.classGroup
                  ? `${t("profile.class")} ${academic.classGroup.code}`
                  : selectedProgramme?.classGroups.length
                    ? t("profile.selectClass")
                    : t("profile.classAwaiting")
              }
              disabled={!selectedProgramme?.classGroups.length}
              onPress={() => setPicker("class")}
            />
          </View>

          {/* Services */}
          <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
            {t("profile.services")}
          </Text>
          <View className="gap-2">
            <NavRow
              icon="school"
              title={t("profile.findClassroom")}
              subtitle={t("profile.findClassroomSub")}
              onPress={() => router.push("/classrooms")}
            />

            {__DEV__ && (
              <NavRow
                icon="notifications-none"
                title={t("profile.sendTestNotification")}
                subtitle={t("profile.sendTestNotificationSub")}
                onPress={async () => Alert.alert(t("profile.notificationsTitle"), await sendTestNotification())}
              />
            )}

            {/* Two languages, so a two-segment switch: both options are named. */}
            <View className="gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
                  <Icon name="language-outline" size={22} color="#04107E" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("profile.language")}</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.languageSub")}</Text>
                </View>
              </View>
              <SegmentedToggle
                value={language}
                onChange={setLanguage}
                options={[
                  { value: "it", label: t("profile.languageIt") },
                  { value: "en", label: t("profile.languageEn") },
                ]}
              />
            </View>
          </View>

          <View className="flex-1" />

          <Pressable
            className="mt-8 flex-row items-center justify-center gap-2 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary py-3.5 active:bg-gray-50 dark:active:bg-white/5"
            onPress={signOut}
            accessibilityRole="button"
          >
            <Icon name="log-out-outline" size={18} color="#DC2626" />
            <Text className="text-center font-semibold text-red-600 dark:text-red-300">{t("common.signOut")}</Text>
          </Pressable>

          {/* Account deletion has to be reachable from inside the app (App Store
              guideline 5.1.1(v)). Plain text rather than a second red button, so it
              reads as the deliberate, rarely-wanted action it is. */}
          <Pressable
            disabled={deleting}
            className="mt-4 items-center py-2 active:opacity-60"
            style={{ marginBottom: insets.bottom + 16 }}
            onPress={confirmDelete}
            accessibilityRole="button"
          >
            {deleting ? (
              <Spinner color="#DC2626" />
            ) : (
              <Text className="text-sm font-medium text-red-600 dark:text-red-300">
                {t("profile.deleteAccount")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}

      {/* Academic profile picker */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        {/* Keeps the search field and the results above the keyboard. */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          {/* Backdrop is a SIBLING behind the sheet, not its parent: nesting the
              sheet inside a Pressable meant the parent intercepted taps and the
              options often didn't register. */}
          <View className="flex-1 justify-end">
            <Pressable
              style={StyleSheet.absoluteFill}
              className="bg-black/40"
              onPress={closePicker}
            />
            <View
              className="rounded-t-3xl bg-white dark:bg-astra-primary pt-3"
              style={{ maxHeight: picker === "programme" ? "88%" : "70%", paddingBottom: insets.bottom + 12 }}
            >
              <Text className="px-5 pb-2 text-lg font-semibold text-gray-900 dark:text-white">
                {picker === "programme"
                  ? t("profile.selectProgramme")
                  : picker === "track"
                    ? t("profile.selectTrack")
                  : picker === "year"
                    ? t("profile.selectYear")
                    : t("profile.selectClass")}
              </Text>
              {picker === "programme" && (
                <View className="mx-5 mb-2 flex-row items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/10 px-3">
                  <Icon name="search" size={16} color="#9CA3AF" />
                  <TextField
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t("profile.searchProgramme")}
                    placeholderTextColor="#9CA3AF"
                    autoCorrect={false}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                    className="flex-1 py-2.5 text-base text-gray-900 dark:text-white"
                  />
                </View>
              )}
              <ScrollView keyboardShouldPersistTaps="handled">
                {picker === "programme" && pickerOptions.length === 0 && (
                  <Text className="px-5 py-6 text-center text-gray-400 dark:text-white/60">{t("profile.noResults")}</Text>
                )}
                {pickerOptions.map((opt) => {
                  if ("header" in opt) {
                    return (
                      <Text
                        key={`h-${opt.header}`}
                        className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60"
                      >
                        {opt.header}
                      </Text>
                    );
                  }
                  const selected = currentValue === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      className="flex-row items-center justify-between px-5 py-3.5 active:bg-gray-50 dark:active:bg-white/5"
                      onPress={() => choose(opt.value)}
                    >
                      <View className="flex-1 pr-3">
                        <Text
                          className={`text-base ${selected ? "font-semibold text-astra-primary dark:text-white" : "font-medium text-gray-900 dark:text-gray-100"}`}
                        >
                          {opt.label}
                        </Text>
                        {opt.sub ? (
                          <Text className="text-[13px] text-gray-500 dark:text-gray-300" numberOfLines={2}>
                            {opt.sub}
                          </Text>
                        ) : null}
                      </View>
                      {selected && <Icon name="checkmark" size={20} color="#04107E" />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
