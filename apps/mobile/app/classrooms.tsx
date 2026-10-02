import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Icon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { queries } from "../lib/prefetch";
import { useT } from "../lib/i18n";
import { useEggStore } from "../lib/egg-store";
import { useRefresh } from "../lib/use-refresh";

// Day options mirror Free@B's own selector.
const DAYS = [
  { key: "today", labelKey: "classrooms.dayToday" },
  { key: "tomorrow", labelKey: "classrooms.dayTomorrow" },
  { key: "day-after", labelKey: "classrooms.dayAfter" },
] as const;

// Half-hour time slots 08:00–21:30; "Now" (null) omits the param → current time.
// "Now" only exists for today; another day starts at the first slot.
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
  const insets = useSafeAreaInsets();
  const inverted = useEggStore((s) => s.inverted);
  const [day, setDay] = useState<(typeof DAYS)[number]["key"]>("today");
  const [time, setTime] = useState<string | null>(null); // null = "Now"
  const [building, setBuilding] = useState("all");
  const [studyOnly, setStudyOnly] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    ...queries.classrooms(day, time),
    refetchInterval: 300_000, // 5 min, like Free@B
    // Switching day/time keeps the previous rooms on screen (the pull-to-refresh
    // spinner shows) instead of blanking the list for every chip tap.
    placeholderData: keepPreviousData,
  });
  const refresh = useRefresh(refetch);

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
    `rounded-full px-3.5 py-2 ${active ? "bg-astra-primary dark:bg-white" : "bg-gray-100 dark:bg-white/10"}`;
  const chipText = (active: boolean) =>
    `text-[13px] font-medium ${active ? "text-white dark:text-astra-primary" : "text-gray-700 dark:text-gray-200"}`;
  const chipHitSlop = { top: 6, bottom: 6 };

  function pickDay(next: (typeof DAYS)[number]["key"]) {
    setDay(next);
    if (next !== "today" && time === null) setTime(TIMES[0]!);
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("classrooms.title")} subtitle={t("classrooms.subtitle")} />

      {/* Filters */}
      <View className="border-b border-gray-100 dark:border-white/10 pb-3">
        {/* Day */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}
        >
          {DAYS.map((d) => (
            <Pressable key={d.key} onPress={() => pickDay(d.key)} className={chip(day === d.key)} hitSlop={chipHitSlop}>
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
          {day === "today" && (
            <Pressable onPress={() => setTime(null)} className={chip(time === null)} hitSlop={chipHitSlop}>
              <View className="flex-row items-center gap-1">
                {/* Lower-case hex on purpose: Icon would remap "#04107E" to
                    white, and the active chip is white in inverted mode. */}
                <Icon
                  name="time-outline"
                  size={14}
                  color={time === null ? (inverted ? "#04107e" : "#fff") : "#6B7280"}
                />
                <Text className={chipText(time === null)}>{t("classrooms.now")}</Text>
              </View>
            </Pressable>
          )}
          {TIMES.map((slot) => (
            <Pressable key={slot} onPress={() => setTime(slot)} className={chip(time === slot)} hitSlop={chipHitSlop}>
              <Text className={chipText(time === slot)}>{slot}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Building, then the study-room filter as the last chip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}
        >
          {["all", ...buildings].map((b) => (
            <Pressable key={b} onPress={() => setBuilding(b)} className={chip(building === b)} hitSlop={chipHitSlop}>
              <Text className={chipText(building === b)}>{b === "all" ? t("classrooms.allBuildings") : b}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setStudyOnly((v) => !v)}
            className={chip(studyOnly)}
            hitSlop={chipHitSlop}
            accessibilityState={{ selected: studyOnly }}
          >
            <Text className={chipText(studyOnly)}>{t("classrooms.studyRoomsOnly")}</Text>
          </Pressable>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => refetch() }}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r, i) => `${r.building}-${r.name}-${i}`}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 8, flexGrow: 1 }}
          refreshControl={<RefreshControl {...refresh} />}
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
            // No timetable data at all, every room busy, or just the filters.
            !data?.rooms.length ? (
              <EmptyState
                icon="calendar-outline"
                title={t("classrooms.notAvailableYet")}
                body={t("classrooms.notAvailableDesc")}
              />
            ) : freeRooms.length === 0 ? (
              <EmptyState icon="time-outline" title={t("classrooms.allBusy")} />
            ) : (
              <EmptyState icon="school-outline" title={t("classrooms.noMatch")} />
            )
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <Text className="shrink text-base font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
                    {item.name}
                  </Text>
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
                  <Text className="text-sm font-medium text-green-600 dark:text-green-300">{t("classrooms.freeStatus")}</Text>
                </View>
                {item.freeUntil && (
                  <Text className="mt-0.5 text-xs text-gray-400 dark:text-white/60">{t("classrooms.untilTime", { time: item.freeUntil })}</Text>
                )}
              </View>
            </View>
          )}
          // The caveats stay with the data but out of the way of the results.
          ListFooterComponent={
            <View className="mt-4 gap-3">
              <View className="flex-row gap-2">
                <Icon name="information-circle-outline" size={14} color="#9CA3AF" />
                <Text className="flex-1 text-[11px] leading-4 text-gray-400 dark:text-white/60">
                  {t("classrooms.disclaimer")}
                </Text>
              </View>
              <Text className="text-center text-[11px] text-gray-400 dark:text-white/60">
                {t("classrooms.credit")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
