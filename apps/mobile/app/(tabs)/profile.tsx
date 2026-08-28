import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Modal, ScrollView, Alert, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { clearToken } from "../../lib/session";
import { sendTestNotification } from "../../lib/push";
import { clearLegacyAcademicProfile, loadLegacyAcademicProfile } from "../../lib/profile-store";
import { useLanguageStore } from "../../lib/language-store";
import { useT } from "../../lib/i18n";

type Picker = "programme" | "track" | "year" | "class" | null;

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
        ? (selectedProgramme?.tracks.map((item) => ({
            value: item.id,
            label: item.name,
          })) ?? [])
      : picker === "year"
        ? Array.from({ length: selectedProgramme?.durationYears ?? 0 }, (_, index) => ({
            value: String(index + 1),
            label: `${t("profile.year")} ${index + 1}`,
          }))
        : (selectedProgramme?.classGroups.map((item) => ({
            value: item.id,
            label: `${t("profile.class")} ${item.code}`,
          })) ?? []);
  const currentValue =
    picker === "programme"
      ? academic?.programme.id
      : picker === "track"
        ? academic?.track?.id
      : picker === "year"
        ? String(academic?.studyYear ?? "")
        : academic?.classGroup?.id;

  async function choose(value: string) {
    if (!catalogue.data) return;
    const programme =
      picker === "programme"
        ? catalogue.data.programmes.find((item) => item.id === value)
        : selectedProgramme;
    if (!programme) return;
    await api.academic.updateProfile({
      programmeId: programme.id,
      studyYear:
        picker === "year"
          ? Number(value)
          : Math.min(academic?.studyYear ?? 1, programme.durationYears),
      trackId:
        picker === "track"
          ? value
          : picker === "programme"
            ? null
            : (academic?.track?.id ?? null),
      classGroupId:
        picker === "class"
          ? value
          : picker === "programme"
            ? null
            : (academic?.classGroup?.id ?? null),
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["materials"] }),
    ]);
    setPicker(null);
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
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
          <View className="h-20 w-20 items-center justify-center rounded-full bg-astra-light">
            <Ionicons name="person" size={36} color="#04107E" />
          </View>
          <Text className="text-xl font-semibold text-gray-900">
            {data.name?.split(" ")[0] ?? t("profile.student")}
          </Text>
          {/* Programme · year · class shown next to the name once selected */}
          {academic ? (
            <Text className="text-sm text-gray-500">
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
            <Text className="text-sm text-gray-400">{t("profile.addAcademicInfo")}</Text>
          )}
          <View className="mt-1 flex-row gap-2">
            {data.roles.map((r) => (
              <Text
                key={r}
                className="rounded-full bg-astra-light px-3 py-1 text-xs font-medium text-astra-primary"
              >
                {r}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Academic selection drives Materials and future gradebook content. */}
      <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {t("profile.academic")}
      </Text>
      <View className="gap-2">
        <Pressable
          className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
          onPress={() => setPicker("programme")}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
            <Ionicons name="book-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500">{t("profile.programme")}</Text>
            <Text className="text-base font-semibold text-gray-900">
              {academic?.programme.code ?? t("profile.selectProgramme")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        {selectedProgramme?.tracks.length ? (
          <Pressable
            className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
            onPress={() => setPicker("track")}
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
              <Ionicons name="git-branch-outline" size={22} color="#04107E" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500">{t("profile.track")}</Text>
              <Text className="text-base font-semibold text-gray-900">
                {academic?.track?.name ?? t("profile.selectTrack")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        ) : null}

        <Pressable
          className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
          onPress={() => academic && setPicker("year")}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
            <Ionicons name="calendar-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500">{t("profile.year")}</Text>
            <Text className="text-base font-semibold text-gray-900">
              {academic ? `${t("profile.year")} ${academic.studyYear}` : t("profile.selectYearProgrammeFirst")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        <Pressable
          className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
          onPress={() => (selectedProgramme?.classGroups.length ? setPicker("class") : undefined)}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
            <Ionicons name="people-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500">{t("profile.class")}</Text>
            <Text className="text-base font-semibold text-gray-900">
              {academic?.classGroup
                ? `${t("profile.class")} ${academic.classGroup.code}`
                : selectedProgramme?.classGroups.length
                  ? t("profile.selectClass")
                  : t("profile.classAwaiting")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Services */}
      <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {t("profile.services")}
      </Text>
      <Pressable
        className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
        onPress={() => router.push("/classrooms")}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
          <Ionicons name="school-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">{t("profile.findClassroom")}</Text>
          <Text className="text-xs text-gray-500">{t("profile.findClassroomSub")}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      {__DEV__ && (
        <Pressable
          className="mt-2 flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
          onPress={async () => Alert.alert(t("profile.notificationsTitle"), await sendTestNotification())}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
            <Ionicons name="notifications-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{t("profile.sendTestNotification")}</Text>
            <Text className="text-xs text-gray-500">{t("profile.sendTestNotificationSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      )}

      <View className="mt-2 flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
          <Ionicons name="language-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">{t("profile.language")}</Text>
          <Text className="text-xs text-gray-500">{t("profile.languageSub")}</Text>
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
        style={{ marginBottom: insets.bottom + 76 }}
        onPress={signOut}
      >
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text className="text-center font-semibold text-red-600">{t("common.signOut")}</Text>
      </Pressable>

      {/* Academic profile picker */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPicker(null)}>
          <Pressable
            className="rounded-t-3xl bg-white pt-3"
            style={{ maxHeight: "70%", paddingBottom: insets.bottom + 12 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 items-center">
              <View className="h-1 w-10 rounded-full bg-gray-300" />
            </View>
            <Text className="px-5 pb-2 text-lg font-semibold text-gray-900">
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
                      className={`flex-1 pr-3 text-base ${selected ? "font-semibold text-astra-primary" : "text-gray-800"}`}
                    >
                      {opt.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={20} color="#04107E" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
