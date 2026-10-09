import { useMemo, useState } from "react";
import { View, SectionList, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Icon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { queries } from "../lib/prefetch";
import { useLocale, useT } from "../lib/i18n";
import { useRefresh } from "../lib/use-refresh";
import { addDays, romeToday, shortDayLabel, toMinutes } from "../lib/rome-date";

// The timetable runs from 08:00 to about 23:00; a slot every half hour.
const TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 22; h++) {
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

const DAY_COUNT = 7;
const LONG_FREE_MINUTES = 60;

// Free@B — which Bocconi classrooms are free, read from the university's own
// room assignments and worked out on our server.
export default function ClassroomsScreen() {
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();

  const [dayIndex, setDayIndex] = useState(0);
  const [time, setTime] = useState<string | null>(null); // null = "Now" (today only)
  const [building, setBuilding] = useState("all");
  const [studyOnly, setStudyOnly] = useState(false);
  const [longOnly, setLongOnly] = useState(false);

  const today = romeToday();
  const days = useMemo(() => Array.from({ length: DAY_COUNT }, (_, i) => addDays(today, i)), [today]);
  // Today goes by name so "now" means now on the server; other days by date.
  const dayParam = dayIndex === 0 ? "today" : days[dayIndex]!;

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery({
    ...queries.classrooms(dayParam, time),
    refetchInterval: 300_000,
    // Switching day or time keeps the previous rooms visible, dimmed, instead of
    // blanking the list on every tap.
    placeholderData: keepPreviousData,
  });
  const refresh = useRefresh(refetch);

  const rooms = useMemo(() => data?.rooms ?? [], [data]);
  const buildings = useMemo(() => Array.from(new Set(rooms.map((r) => r.building))), [rooms]);
  const atMinutes = data?.time ? toMinutes(data.time) : null;

  const sections = useMemo(() => {
    const matches = rooms.filter(
      (r) =>
        r.status === "free" &&
        (building === "all" || r.building === building) &&
        (!studyOnly || r.isStudyRoom) &&
        (!longOnly || !r.freeUntil || atMinutes === null || toMinutes(r.freeUntil) - atMinutes >= LONG_FREE_MINUTES),
    );
    return buildings
      .map((b) => {
        const all = rooms.filter((r) => r.building === b);
        return {
          building: b,
          total: all.length,
          free: all.filter((r) => r.status === "free").length,
          data: matches.filter((r) => r.building === b),
        };
      })
      .filter((s) => s.data.length > 0);
  }, [rooms, buildings, building, studyOnly, longOnly, atMinutes]);

  const visibleCount = sections.reduce((n, s) => n + s.data.length, 0);
  const anyFree = rooms.some((r) => r.status === "free");

  function pickDay(index: number) {
    setDayIndex(index);
    // "Now" only means something today; another day starts with the morning.
    if (index !== 0 && time === null) setTime(TIMES[0]!);
  }

  function floorLabel(floor: string | null | undefined) {
    if (!floor) return "";
    if (floor === "terra") return t("classrooms.floorGround");
    if (floor === "seminterrato") return t("classrooms.floorBasement");
    return t("classrooms.floor", { n: floor });
  }

  const chip = (active: boolean) =>
    `min-h-[36px] justify-center rounded-full px-3.5 py-2 ${active ? "bg-astra-primary dark:bg-white" : "bg-gray-100 dark:bg-white/10"}`;
  const chipText = (active: boolean) =>
    `text-[13px] font-medium ${active ? "text-white dark:text-astra-primary" : "text-gray-700 dark:text-gray-200"}`;
  const chipHitSlop = { top: 6, bottom: 6 };

  const updated =
    data?.timestamp && !Number.isNaN(new Date(data.timestamp).getTime())
      ? new Date(data.timestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })
      : null;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("classrooms.title")} subtitle={t("classrooms.subtitle")} />

      {/* Filters */}
      <View className="border-b border-gray-100 dark:border-white/10 pb-3">
        {/* Day: today, tomorrow, then the rest of the week */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
          {days.map((date, i) => (
            <Chip
              key={date}
              active={dayIndex === i}
              onPress={() => pickDay(i)}
              label={i === 0 ? t("classrooms.dayToday") : i === 1 ? t("classrooms.dayTomorrow") : shortDayLabel(date, locale)}
            />
          ))}
        </ScrollView>

        {/* Time */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
          {dayIndex === 0 && <Chip active={time === null} onPress={() => setTime(null)} label={t("classrooms.now")} />}
          {TIMES.map((slot) => (
            <Chip key={slot} active={time === slot} onPress={() => setTime(slot)} label={slot} />
          ))}
        </ScrollView>

        {/* Building, then the two room filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
          {["all", ...buildings].map((b) => (
            <Chip
              key={b}
              active={building === b}
              onPress={() => setBuilding(b)}
              label={b === "all" ? t("classrooms.allBuildings") : b}
            />
          ))}
          <Pressable
            onPress={() => setStudyOnly((v) => !v)}
            className={chip(studyOnly)}
            hitSlop={chipHitSlop}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: studyOnly }}
          >
            <Text chrome className={chipText(studyOnly)}>{t("classrooms.studyRoomsOnly")}</Text>
          </Pressable>
          <Pressable
            onPress={() => setLongOnly((v) => !v)}
            className={chip(longOnly)}
            hitSlop={chipHitSlop}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: longOnly }}
          >
            <Text chrome className={chipText(longOnly)}>{t("classrooms.longFreeOnly")}</Text>
          </Pressable>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : error && !data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => refetch() }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(r) => `${r.building}|${r.name}`}
          stickySectionHeadersEnabled={false}
          // The previous slot's rooms stay on screen while the new one loads; dim
          // them so nobody reads them as the answer for the new time.
          style={{ opacity: isPlaceholderData ? 0.45 : 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, flexGrow: 1 }}
          refreshControl={<RefreshControl {...refresh} />}
          ListHeaderComponent={
            <View>
              <Text className="text-sm text-gray-500 dark:text-gray-300" accessibilityLiveRegion="polite">
                {visibleCount === 1
                  ? t("classrooms.freeRoomsCountSingular", { count: String(visibleCount) })
                  : t("classrooms.freeRoomsCountPlural", { count: String(visibleCount) })}
                {building !== "all" ? t("classrooms.inBuilding", { building }) : ""}
                {data?.time ? t("classrooms.atTime", { time: data.time }) : ""}
              </Text>
              {data && data.complete === false && (
                <Text className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("classrooms.incomplete")}</Text>
              )}
            </View>
          }
          ListEmptyComponent={
            // No timetable at all, every room busy, or just the filters.
            rooms.length === 0 ? (
              <EmptyState icon="calendar-outline" title={t("classrooms.notAvailableYet")} body={t("classrooms.notAvailableDesc")} />
            ) : !anyFree ? (
              <EmptyState icon="time-outline" title={t("classrooms.allBusy")} />
            ) : (
              <EmptyState icon="school-outline" title={t("classrooms.noMatch")} />
            )
          }
          renderSectionHeader={({ section }) => (
            <View className="mb-2 mt-5 flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
                {section.building}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-300">
                {t("classrooms.sectionCount", { free: String(section.free), total: String(section.total) })}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const floor = floorLabel(item.floor);
            const when = item.isStudyRoom && item.studyUntil
              ? t("classrooms.studyUntil", { time: item.studyUntil })
              : item.freeUntil
                ? t("classrooms.untilTime", { time: item.freeUntil })
                : t("classrooms.restOfDay");
            return (
              <View
                accessible
                accessibilityLabel={[item.name, item.building, floor, t("classrooms.freeStatus"), when].filter(Boolean).join(", ")}
                className="mb-2 flex-row items-center justify-between rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4"
              >
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
                  {floor ? <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">{floor}</Text> : null}
                </View>
                <View className="items-end">
                  <View className="flex-row items-center gap-1">
                    <View className="h-2 w-2 rounded-full bg-green-500" />
                    <Text className="text-sm font-medium text-green-700 dark:text-green-300">{t("classrooms.freeStatus")}</Text>
                  </View>
                  <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">{when}</Text>
                </View>
              </View>
            );
          }}
          // The caveats stay with the data but out of the way of the results.
          ListFooterComponent={
            <View className="mt-6 gap-3">
              <View className="flex-row gap-2">
                <Icon name="information-circle-outline" size={14} color="#9CA3AF" />
                <Text className="flex-1 text-[11px] leading-4 text-gray-500 dark:text-white/60">{t("classrooms.disclaimer")}</Text>
              </View>
              <Text className="text-center text-[11px] text-gray-500 dark:text-white/60">
                {[updated ? t("classrooms.updated", { time: updated }) : null, t("classrooms.credit")].filter(Boolean).join("  ·  ")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
