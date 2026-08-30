import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Switch,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { MeResponse } from "@astra/shared";
import { Icon } from "../components/Icon";
import { api } from "../lib/api";
import { clearToken } from "../lib/session";
import { sendTestNotification } from "../lib/push";
import { clearLegacyAcademicProfile, loadLegacyAcademicProfile } from "../lib/profile-store";
import { useLanguageStore } from "../lib/language-store";
import { useT } from "../lib/i18n";

type Picker = "programme" | "track" | "year" | "class" | null;

/** Sentinel row in the track/class sheets — both are optional, so both clear. */
const CLEAR = "__clear__";

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
    } catch (e) {
      setDeleting(false);
      Alert.alert(
        t("profile.deleteAccountFailedTitle"),
        e instanceof Error ? e.message : t("profile.deleteAccountFailedBody"),
      );
    }
  }

  const academic = data?.academicProfile ?? null;
  const selectedProgramme = catalogue.data?.programmes.find(
    (item) => item.id === academic?.programme.id
  );
  const pickerOptions: { value: string; label: string }[] =
    picker === "programme"
      ? (catalogue.data?.programmes.map((item) => ({
          value: item.id,
          label: `${item.name} (${item.code})${item.legacy ? t("profile.legacySuffix") : ""}`,
        })) ?? [])
      : picker === "track"
        ? [
            { value: CLEAR, label: t("profile.noTrack") },
            ...(selectedProgramme?.tracks.map((item) => ({
              value: item.id,
              label: item.name,
            })) ?? []),
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
    const nextTrackId =
      current === "track"
        ? (cleared ? null : value)
        : current === "programme"
          ? null
          : (academic?.track?.id ?? null);
    const nextClassId =
      current === "class"
        ? (cleared ? null : value)
        : current === "programme"
          ? null
          : (academic?.classGroup?.id ?? null);

    // Close first. Waiting for the write and the refetches before dismissing
    // made the sheet sit there for seconds and feel broken.
    setPicker(null);

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
    } catch (e) {
      // Put the old selection back rather than leaving a value on screen that
      // was never actually saved.
      if (previous) queryClient.setQueryData(["me"], previous);
      Alert.alert(
        t("profile.saveFailedTitle"),
        e instanceof Error ? e.message : t("profile.saveFailedBody"),
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
      <View className="flex-row items-center gap-2 border-b border-gray-100 dark:border-white/10 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Icon name="chevron-back" size={26} color="#04107E" />
        </Pressable>
        <Text className="text-lg font-semibold text-astra-primary dark:text-white">{t("tabs.profile")}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, flexGrow: 1 }}
      >
      {isLoading && <ActivityIndicator />}

      {error && (
        <View className="gap-2">
          <Text className="text-red-600">{String((error as Error).message)}</Text>
          <Pressable className="rounded-lg border border-gray-300 px-4 py-3" onPress={() => refetch()}>
            <Text className="text-center">{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {data && (
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
          <View className="mt-1 flex-row gap-2">
            {data.roles.map((r) => (
              <Text
                key={r}
                className="rounded-full bg-astra-light dark:bg-white/10 px-3 py-1 text-xs font-medium text-astra-primary dark:text-white"
              >
                {r}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Academic selection drives Materials and future gradebook content. */}
      <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
        {t("profile.academic")}
      </Text>
      <View className="gap-2">
        <Pressable
          className="flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4 active:bg-gray-50"
          onPress={() => setPicker("programme")}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
            <Icon name="book-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.programme")}</Text>
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {academic?.programme.code ?? t("profile.selectProgramme")}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        {selectedProgramme?.tracks.length ? (
          <Pressable
            className="flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4 active:bg-gray-50"
            onPress={() => setPicker("track")}
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
              <Icon name="git-branch-outline" size={22} color="#04107E" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.track")}</Text>
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {academic?.track?.name ?? t("profile.selectTrack")}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        ) : null}

        {/* Year needs a programme first (it bounds how many years exist), so
            without one the row is visibly disabled rather than a tap that
            silently does nothing. */}
        <Pressable
          disabled={!academic}
          className={`flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4 ${
            academic ? "active:bg-gray-50" : "opacity-40"
          }`}
          onPress={() => setPicker("year")}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
            <Icon name="calendar-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.year")}</Text>
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {academic ? `${t("profile.year")} ${academic.studyYear}` : t("profile.selectYearProgrammeFirst")}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        {/* Same for class: some programmes publish no class groups at all, and
            the row said "awaiting" while still looking tappable. Note class is
            never used to filter Materials — it exists for future gradebook
            content — so leaving it unset costs a student nothing. */}
        <Pressable
          disabled={!selectedProgramme?.classGroups.length}
          className={`flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4 ${
            selectedProgramme?.classGroups.length ? "active:bg-gray-50" : "opacity-40"
          }`}
          onPress={() => setPicker("class")}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
            <Icon name="people-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.class")}</Text>
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {academic?.classGroup
                ? `${t("profile.class")} ${academic.classGroup.code}`
                : selectedProgramme?.classGroups.length
                  ? t("profile.selectClass")
                  : t("profile.classAwaiting")}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Services */}
      <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
        {t("profile.services")}
      </Text>
      <Pressable
        className="flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4 active:bg-gray-50"
        onPress={() => router.push("/classrooms")}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
          <Icon name="school-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("profile.findClassroom")}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.findClassroomSub")}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      {__DEV__ && (
        <Pressable
          className="mt-2 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4 active:bg-gray-50"
          onPress={async () => Alert.alert(t("profile.notificationsTitle"), await sendTestNotification())}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
            <Icon name="notifications-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("profile.sendTestNotification")}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.sendTestNotificationSub")}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      )}

      <View className="mt-2 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
          <Icon name="language-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("profile.language")}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-300">{t("profile.languageSub")}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className={language === "it" ? "text-base" : "text-base opacity-40"}>🇮🇹</Text>
          <Switch
            value={language === "en"}
            onValueChange={(value) => setLanguage(value ? "en" : "it")}
            trackColor={{ false: "#04107E", true: "#04107E" }}
          />
          <Text className={language === "en" ? "text-base" : "text-base opacity-40"}>🇬🇧</Text>
        </View>
      </View>

      <View className="flex-1" />

      {/* Sign out — lifted clear of the tab bar, red outline */}
      <Pressable
        className="mt-6 flex-row items-center justify-center gap-2 rounded-xl border-2 border-red-500 px-4 py-3 active:bg-red-50"
        onPress={signOut}
      >
        <Icon name="log-out-outline" size={18} color="#DC2626" />
        <Text className="text-center font-semibold text-red-600">{t("common.signOut")}</Text>
      </Pressable>

      {/* Account deletion has to be reachable from inside the app (App Store
          guideline 5.1.1(v)). Plain text rather than a second red button, so it
          reads as the deliberate, rarely-wanted action it is. */}
      <Pressable
        disabled={deleting}
        className="mt-4 items-center py-2 active:opacity-60"
        style={{ marginBottom: insets.bottom + 16 }}
        onPress={confirmDelete}
      >
        {deleting ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <Text className="text-sm font-medium text-red-600 underline">
            {t("profile.deleteAccount")}
          </Text>
        )}
      </Pressable>

      {/* Academic profile picker */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        {/* Backdrop is a SIBLING behind the sheet, not its parent: nesting the
            sheet inside a Pressable meant the parent intercepted taps and the
            options often didn't register. */}
        <View className="flex-1 justify-end">
          <Pressable
            style={StyleSheet.absoluteFill}
            className="bg-black/40"
            onPress={() => setPicker(null)}
          />
          <View
            className="rounded-t-3xl bg-white dark:bg-astra-primary pt-3"
            style={{ maxHeight: "70%", paddingBottom: insets.bottom + 12 }}
          >
            <View className="mb-2 items-center">
              <View className="h-1 w-10 rounded-full bg-gray-300" />
            </View>
            <Text className="px-5 pb-2 text-lg font-semibold text-gray-900 dark:text-white">
              {picker === "programme"
                ? t("profile.selectProgramme")
                : picker === "track"
                  ? t("profile.selectTrack")
                : picker === "year"
                  ? t("profile.selectYear")
                  : t("profile.selectClass")}
            </Text>
            <ScrollView>
              {pickerOptions.map((opt) => {
                const selected = currentValue === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    className="flex-row items-center justify-between px-5 py-4 active:bg-gray-50"
                    onPress={() => choose(opt.value)}
                  >
                    <Text
                      className={`flex-1 pr-3 text-base ${selected ? "font-semibold text-astra-primary dark:text-white" : "text-gray-800 dark:text-gray-100"}`}
                    >
                      {opt.label}
                    </Text>
                    {selected && <Icon name="checkmark" size={20} color="#04107E" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
