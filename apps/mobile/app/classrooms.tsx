import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Icon } from "../components/Icon";
import { api } from "../lib/api";
import { useT } from "../lib/i18n";

// Day options mirror Free@B's own selector.
const DAYS = [
  { key: "today", labelKey: "classrooms.dayToday" },
  { key: "tomorrow", labelKey: "classrooms.dayTomorrow" },
  { key: "day-after", labelKey: "classrooms.dayAfter" },
] as const;

// Half-hour time slots 08:00–21:30; "Now" (null) omits the param → current time.
const TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 21; h++) {
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

// Free@B — live Bocconi free-classroom availability, rendered natively.
export default function ClassroomsScreen() {
  const t = useT();
  const [day, setDay] = useState<(typeof DAYS)[number]["key"]>("today");
  const [time, setTime] = useState<string | null>(null); // null = "Now"
  const [building, setBuilding] = useState("all");
  const [studyOnly, setStudyOnly] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["classrooms", day, time],
    queryFn: () => api.classrooms.list({ day, time: time ?? undefined }),
    retry: false,
    refetchInterval: 300_000, // 5 min, like Free@B
  });

  const freeRooms = useMemo(
    () => (data?.rooms ?? []).filter((r) => r.status === "free"),
    [data],
  );
  const buildings = useMemo(
    () => Array.from(new Set(freeRooms.map((r) => r.building))).sort(),
    [freeRooms],
  );
  const visible = freeRooms.filter(
    (r) => (building === "all" || r.building === building) && (!studyOnly || r.isStudyRoom),
  );

  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 ${active ? "bg-astra-primary dark:bg-astra-dark" : "bg-gray-100"}`;
  const chipText = (active: boolean) => (active ? "font-medium text-white" : "text-gray-600 dark:text-gray-300");

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-gray-100 dark:border-white/10 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Icon name="chevron-back" size={26} color="#04107E" />
        </Pressable>
        <View>
          <Text className="text-lg font-semibold text-astra-primary dark:text-white">{t("classrooms.title")}</Text>
          <Text className="text-xs text-gray-400 dark:text-white/60">{t("classrooms.subtitle")}</Text>
        </View>
      </View>

      {/* Filters */}
      <View className="border-b border-gray-100 dark:border-white/10 pb-3">
        {/* Day */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}
        >
          {DAYS.map((d) => (
            <Pressable key={d.key} onPress={() => setDay(d.key)} className={chip(day === d.key)}>
              <Text className={chipText(day === d.key)}>{t(d.labelKey)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Time */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}
        >
          <Pressable onPress={() => setTime(null)} className={chip(time === null)}>
            <View className="flex-row items-center gap-1">
              <Icon name="time-outline" size={14} color={time === null ? "#fff" : "#6B7280"} />
              <Text className={chipText(time === null)}>{t("classrooms.now")}</Text>
            </View>
          </Pressable>
          {TIMES.map((slot) => (
            <Pressable key={slot} onPress={() => setTime(slot)} className={chip(time === slot)}>
              <Text className={chipText(time === slot)}>{slot}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Building */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}
        >
          {["all", ...buildings].map((b) => (
            <Pressable key={b} onPress={() => setBuilding(b)} className={chip(building === b)}>
              <Text className={chipText(building === b)}>{b === "all" ? t("classrooms.allBuildings") : b}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Study-only */}
        <Pressable
          onPress={() => setStudyOnly((v) => !v)}
          className="mx-4 mt-3 flex-row items-center gap-2"
          hitSlop={6}
        >
          <Ionicons
            name={studyOnly ? "checkbox" : "square-outline"}
            size={20}
            color={studyOnly ? "#04107E" : "#9CA3AF"}
          />
          <Text className="text-sm text-gray-700 dark:text-gray-200">{t("classrooms.studyRoomsOnly")}</Text>
        </Pressable>
      </View>

      {/* Disclaimer — static above the results, flagged with ⚠️ so students actually read it */}
      <View className="flex-row gap-2 bg-amber-50 px-4 py-3">
        <Text className="text-base">⚠️</Text>
        <Text className="flex-1 text-xs leading-4 text-amber-800">{t("classrooms.disclaimer")}</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-red-600">{String((error as Error).message)}</Text>
          <Pressable className="rounded-lg border border-gray-300 px-4 py-3" onPress={() => refetch()}>
            <Text>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r, i) => `${r.building}-${r.name}-${i}`}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          ListHeaderComponent={
            <Text className="mb-1 text-sm text-gray-500 dark:text-gray-300">
              {visible.length === 1
                ? t("classrooms.freeRoomsCountSingular", { count: String(visible.length) })
                : t("classrooms.freeRoomsCountPlural", { count: String(visible.length) })}
              {building !== "all" ? t("classrooms.inBuilding", { building }) : ""}
              {time ? t("classrooms.atTime", { time }) : ""}
            </Text>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-2 px-10 pt-24">
              <Icon name="calendar-outline" size={34} color="#9CA3AF" />
              <Text className="text-center text-base font-semibold text-gray-700 dark:text-gray-200">
                {t("classrooms.notAvailableYet")}
              </Text>
              <Text className="text-center text-sm leading-5 text-gray-400 dark:text-white/60">
                {t("classrooms.notAvailableDesc")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">{item.name}</Text>
                  {item.isStudyRoom && (
                    <Text className="rounded-full bg-astra-light dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-astra-primary dark:text-white">
                      {t("classrooms.studyBadge")}
                    </Text>
                  )}
                </View>
                <Text className="mt-0.5 text-xs text-gray-400 dark:text-white/60">{item.building}</Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center gap-1">
                  <View className="h-2 w-2 rounded-full bg-green-500" />
                  <Text className="text-sm font-medium text-green-600">{t("classrooms.freeStatus")}</Text>
                </View>
                {item.freeUntil && (
                  <Text className="mt-0.5 text-xs text-gray-400 dark:text-white/60">{t("classrooms.untilTime", { time: item.freeUntil })}</Text>
                )}
              </View>
            </View>
          )}
          ListFooterComponent={
            <Text className="mt-4 text-center text-[11px] text-gray-400 dark:text-white/60">
              {t("classrooms.credit")}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
