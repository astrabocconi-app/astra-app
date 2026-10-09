import { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import { Text } from "../components/AppText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { AcademicCatalogueResponse, MeResponse } from "@astra/shared";
import { Icon, Spinner } from "../components/Icon";
import { NavRow } from "../components/NavRow";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { SegmentedToggle } from "../components/SegmentedToggle";
import { api } from "../lib/api";
import { signOutAndReset } from "../lib/sign-out";
import { sendTestNotification } from "../lib/push";
import { alertAfterModal } from "../lib/alert";
import { announce } from "../lib/use-reduced-motion";
import { useLanguageStore } from "../lib/language-store";
import { useT } from "../lib/i18n";
import { TextField } from "../components/TextField";
import { ProfileIdentity } from "../components/ProfileEditors";

type Picker = "programme" | "track" | "year" | "class" | null;
type Programme = AcademicCatalogueResponse["programmes"][number];

/** Sentinel row in the class sheet — class is optional, so it can be cleared. */
const CLEAR = "__clear__";

/** Programme sheet sections, in the order a student scans for theirs. */
const LEVEL_SECTIONS = [
  { level: "BACHELOR", label: "profile.levelBachelor" },
  { level: "INTEGRATED_MASTER", label: "profile.levelIntegrated" },
  { level: "MASTER_OF_SCIENCE", label: "profile.levelMsc" },
] as const;

type SheetRow = { header: string } | { value: string; label: string; sub?: string };

/** Tracks a student of `year` can already choose (BIEF splits into Economics / Finance in year 2). */
const tracksOpenAt = (p: Programme | undefined | null, year: number) =>
  // `?? 1`: an API from before fromYear existed sends tracks without it.
  p?.tracks.filter((item) => (item.fromYear ?? 1) <= year) ?? [];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
  });
  const catalogue = useQuery({
    queryKey: ["academic-catalogue"],
    queryFn: () => api.academic.catalogue(),
  });
  const { language, setLanguage } = useLanguageStore();
  const t = useT();
  const [picker, setPicker] = useState<Picker>(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  // A programme or year change that needs a track the student has not chosen
  // yet. Nothing is saved until they do: the server refuses a profile without
  // one (TRACK_REQUIRED), and half a change must not be written.
  const [draft, setDraft] = useState<{ programme: Programme; year: number } | null>(null);

  /**
   * Signing out and deleting end the same way: a full reset, then the login.
   */
  function signOut() {
    void signOutAndReset();
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
      // The account is gone; drop the token, every cached response and
      // everything saved on this phone with it.
      await signOutAndReset({ serverKnowsUs: false });
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
  const studyYear = academic?.studyYear ?? 1;
  // What the track/year/class sheets are about: the change in progress, or the saved selection.
  const activeProgramme = draft?.programme ?? selectedProgramme;
  const activeYear = draft?.year ?? studyYear;
  const tracksForYear = tracksOpenAt(selectedProgramme, studyYear);

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
        ? // Required when one is open, so there is no "no track" row.
          tracksOpenAt(activeProgramme, activeYear).map((item) => ({ value: item.id, label: item.name, sub: item.code }))
      : picker === "year"
        ? Array.from({ length: activeProgramme?.durationYears ?? 0 }, (_, index) => ({
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
      ? (draft?.programme.id ?? academic?.programme.id)
      : picker === "track"
        ? academic?.track?.id
      : picker === "year"
        ? String(draft?.year ?? academic?.studyYear ?? "")
        : (academic?.classGroup?.id ?? CLEAR);

  function closePicker() {
    setPicker(null);
    setSearch("");
    setDraft(null);
  }

  /** Paint the new selection at once, save it, and put the old one back if the save fails. */
  async function commit(programme: Programme, year: number, trackId: string | null, classGroupId: string | null) {
    if (!catalogue.data) return;
    const previous = queryClient.getQueryData<MeResponse>(["me"]);
    // Paint first. Without this the row kept showing the OLD value until the
    // refetch came back — you tapped "Year 2" and the row still said "Year 1"
    // for a beat, which is what made these pickers feel broken. The write is
    // confirmed by the refetch below.
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
              studyYear: year,
              track: tracks.find((item) => item.id === trackId) ?? null,
              classGroup: classGroups.find((item) => item.id === classGroupId) ?? null,
              updatedAt: new Date().toISOString(),
            },
          }
        : old,
    );
    try {
      await api.academic.updateProfile({ programmeId: programme.id, studyYear: year, trackId, classGroupId });
      announce(t("profile.saved"));
    } catch {
      // Put the old selection back rather than leaving a value on screen that
      // was never actually saved. The sheet that started this is still fading
      // out, so the alert waits for it.
      if (previous) queryClient.setQueryData(["me"], previous);
      alertAfterModal(t("profile.saveFailedTitle"), t("profile.saveFailedBody"));
    } finally {
      // Refresh in the background — the sheet is already gone.
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
  }

  function choose(value: string) {
    if (!catalogue.data) return;
    setSearch("");

    if (picker === "programme") {
      const programme = catalogue.data.programmes.find((item) => item.id === value);
      if (!programme) return;
      // The track and class belong to the old programme, so they go; the year stays when it still exists.
      const year = Math.min(academic?.studyYear ?? 1, programme.durationYears);
      if (tracksOpenAt(programme, year).length) {
        // Needs a track: ask for the year, then the track, and save once.
        setDraft({ programme, year });
      } else {
        void commit(programme, year, null, null);
      }
      // Picking a programme leads straight to the year.
      setPicker("year");
      return;
    }

    const programme = activeProgramme;
    if (!programme) return;

    if (picker === "year") {
      const year = Number(value);
      const keptTrack = programme.tracks.find((item) => item.id === (draft ? null : academic?.track?.id));
      const tracks = tracksOpenAt(programme, year);
      if (tracks.length && !(keptTrack && (keptTrack.fromYear ?? 1) <= year)) {
        // A year that opens tracks leads to the track.
        setDraft({ programme, year });
        setPicker("track");
        return;
      }
      setDraft(null);
      setPicker(null);
      void commit(programme, year, tracks.length ? (keptTrack?.id ?? null) : null, draft ? null : (academic?.classGroup?.id ?? null));
      return;
    }

    if (picker === "track") {
      const year = draft?.year ?? studyYear;
      setDraft(null);
      setPicker(null);
      void commit(programme, year, value, draft ? null : (academic?.classGroup?.id ?? null));
      return;
    }

    // class
    setPicker(null);
    void commit(programme, studyYear, academic?.track?.id ?? null, value === CLEAR ? null : value);
  }

  const sheetTitle =
    picker === "programme"
      ? t("profile.selectProgramme")
      : picker === "track"
        ? t("profile.selectTrack")
        : picker === "year"
          ? t("profile.selectYear")
          : t("profile.selectClass");

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      {/* Reached from the Home header rather than a tab, so it carries its own
          back affordance like the other pushed screens. */}
      <ScreenHeader title={t("tabs.profile")} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (error && !data) || !data ? (
        <View className="flex-1">
          <EmptyState
            icon="cloud-offline-outline"
            title={t("common.error")}
            action={{ label: t("common.retry"), onPress: () => refetch() }}
          />
          {/* A profile that will not load must not be a dead end: signing out has to stay reachable. */}
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            className="mb-6 min-h-[44px] items-center justify-center self-center px-6"
            style={{ marginBottom: insets.bottom + 16 }}
          >
            <Text chrome className="font-semibold text-red-700 dark:text-red-300">{t("common.signOut")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
        >
          <ProfileIdentity
            me={data}
            subtitle={
              // Programme · year · class shown next to the name once selected
              academic ? (
                <Text className="text-center text-sm text-gray-600 dark:text-gray-300">
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
                <Text className="text-center text-sm text-gray-600 dark:text-white/70">{t("profile.addAcademicInfo")}</Text>
              )
            }
          />

          {/* Academic selection drives Materials. */}
          <Text accessibilityRole="header" className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
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
          <Text accessibilityRole="header" className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
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
                  <Text className="text-xs text-gray-600 dark:text-gray-300">{t("profile.languageSub")}</Text>
                </View>
              </View>
              <SegmentedToggle
                value={language}
                onChange={(l) => void setLanguage(l)}
                options={[
                  { value: "it", label: t("profile.languageIt") },
                  { value: "en", label: t("profile.languageEn") },
                ]}
              />
            </View>
          </View>

          <View className="flex-1" />

          <Pressable
            className="mt-8 min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary py-3.5 active:bg-gray-50 dark:active:bg-white/5"
            onPress={signOut}
            accessibilityRole="button"
          >
            <Icon name="log-out-outline" size={18} color="#B91C1C" />
            <Text chrome className="text-center font-semibold text-red-700 dark:text-red-300">{t("common.signOut")}</Text>
          </Pressable>

          {/* Account deletion has to be reachable from inside the app (App Store
              guideline 5.1.1(v)). Plain text rather than a second red button, so it
              reads as the deliberate, rarely-wanted action it is. */}
          <Pressable
            disabled={deleting}
            className="mt-4 min-h-[44px] flex-row items-center justify-center gap-2 py-2 active:opacity-60"
            style={{ marginBottom: insets.bottom + 16 }}
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityLabel={t("profile.deleteAccount")}
            accessibilityState={{ disabled: deleting, busy: deleting }}
          >
            {deleting ? <Spinner color="#B91C1C" /> : null}
            <Text chrome className="text-sm font-medium text-red-700 dark:text-red-300">
              {t("profile.deleteAccount")}
            </Text>
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
        {/* Keeps the search field and the results above the keyboard ("padding" on
            Android too: edge-to-edge windows are not resized for it). */}
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} accessibilityViewIsModal>
          {/* Backdrop is a SIBLING behind the sheet, not its parent: nesting the
              sheet inside a Pressable meant the parent intercepted taps and the
              options often didn't register. */}
          <View className="flex-1 justify-end">
            <Pressable
              style={StyleSheet.absoluteFill}
              className="bg-black/40"
              onPress={closePicker}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            />
            <View
              className="rounded-t-3xl bg-white dark:bg-astra-primary pt-3"
              style={{ maxHeight: picker === "programme" ? "88%" : "70%", paddingBottom: insets.bottom + 12 }}
            >
              <Text accessibilityRole="header" className="px-5 pb-2 text-lg font-semibold text-gray-900 dark:text-white">
                {sheetTitle}
              </Text>
              {picker === "programme" && (
                <View className="mx-5 mb-2 min-h-[44px] flex-row items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/10 px-3">
                  <Icon name="search" size={16} color="#6B7280" />
                  <TextField
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t("profile.searchProgramme")}
                    accessibilityLabel={t("profile.searchProgramme")}
                    placeholderTextColor="#6B7280"
                    autoCorrect={false}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                    className="flex-1 py-2.5 text-base text-gray-900 dark:text-white"
                  />
                </View>
              )}
              <ScrollView keyboardShouldPersistTaps="handled" accessibilityRole={picker === "programme" ? undefined : "radiogroup"}>
                {picker === "programme" && pickerOptions.length === 0 && (
                  <Text className="px-5 py-6 text-center text-gray-600 dark:text-white/70">{t("profile.noResults")}</Text>
                )}
                {pickerOptions.map((opt) => {
                  if ("header" in opt) {
                    return (
                      <Text
                        key={`h-${opt.header}`}
                        accessibilityRole="header"
                        className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70"
                      >
                        {opt.header}
                      </Text>
                    );
                  }
                  const selected = currentValue === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      className="min-h-[52px] flex-row items-center justify-between px-5 py-3.5 active:bg-gray-50 dark:active:bg-white/5"
                      onPress={() => choose(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                    >
                      <View className="flex-1 pr-3">
                        <Text
                          className={`text-base ${selected ? "font-semibold text-astra-primary dark:text-white" : "font-medium text-gray-900 dark:text-gray-100"}`}
                        >
                          {opt.label}
                        </Text>
                        {opt.sub ? (
                          <Text className="text-[13px] text-gray-600 dark:text-gray-300" numberOfLines={3}>
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
