import { useMemo, useState } from "react";
import { View, SectionList, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Icon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { AppSwitch } from "../components/AppSwitch";
import { queries } from "../lib/prefetch";
import { useLocale, useT } from "../lib/i18n";
import { useRefresh } from "../lib/use-refresh";
import { addDays, romeToday, shortDayLabel, toMinutes } from "../lib/rome-date";
import { withBuffer } from "../lib/free-rooms";

// The timetable runs from 08:00 to about 23:00; a slot every half hour.
const TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 22; h++) {
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

// Today and the next two days: further out Bocconi has usually not published
// the room assignments yet, so those days only ever showed "no timetable".
const DAY_COUNT = 3;
const LONG_FREE_MINUTES = 60;

// The two teaching buildings, by the names students use. The timetable calls
// them by address; anything else it lists (Roentgen, one-off spaces) is left out.
const BUILDINGS: { source: string; label: string }[] = [
  { source: "sarfatti 25", label: "Leoni" },
  { source: "sraffa 13", label: "Velodromo" },
];
const buildingLabel = (b: string) => BUILDINGS.find((x) => x.source === b.trim().toLowerCase())?.label ?? null;

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

  const atMinutes = data?.time ? toMinutes(data.time) : null;
  // Rooms renamed to their building's everyday name (other buildings dropped),
  // free until 15 minutes before their next class.
  const rooms = useMemo(
    () =>
      (data?.rooms ?? []).flatMap((r) => {
        const label = buildingLabel(r.building);
        return label ? [withBuffer({ ...r, building: label }, atMinutes)] : [];
      }),
    [data, atMinutes],
  );
  const buildings = useMemo(() => BUILDINGS.map((b) => b.label).filter((b) => rooms.some((r) => r.building === b)), [rooms]);

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

        {/* Building */}
        <View className="flex-row flex-wrap gap-2 px-4 pt-2">
          {["all", ...BUILDINGS.map((b) => b.label)].map((b) => (
            <Chip
              key={b}
              active={building === b}
              onPress={() => setBuilding(b)}
              label={b === "all" ? t("classrooms.allBuildings") : b}
            />
          ))}
        </View>

        {/* Room filters: switches on their own row, not more chips beside the
            buildings, so they read as "also" rather than "another building". */}
        <View className="mx-4 mt-3 flex-row gap-2">
          <View className="min-h-[48px] flex-1 flex-row items-center justify-between gap-2 rounded-2xl bg-gray-50 dark:bg-white/5 pl-3.5 pr-2">
            <Text chrome className="flex-1 text-[13px] font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
              {t("classrooms.studyRoomsOnly")}
            </Text>
            <AppSwitch value={studyOnly} onValueChange={setStudyOnly} label={t("classrooms.studyRoomsOnly")} />
          </View>
          <View className="min-h-[48px] flex-1 flex-row items-center justify-between gap-2 rounded-2xl bg-gray-50 dark:bg-white/5 pl-3.5 pr-2">
            <Text chrome className="flex-1 text-[13px] font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
              {t("classrooms.longFreeOnly")}
            </Text>
            <AppSwitch value={longOnly} onValueChange={setLongOnly} label={t("classrooms.longFreeOnly")} />
          </View>
        </View>
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
              {/* The two caveats, up front where they are read. */}
              <View className="mb-2 gap-2">
                <View className="flex-row gap-2 rounded-2xl border border-amber-200 dark:border-amber-300/30 bg-amber-50 dark:bg-amber-300/10 p-3">
                  <Icon name="warning" size={16} color="#B45309" />
                  <Text className="flex-1 text-[12px] leading-[17px] text-amber-900 dark:text-amber-100">{t("classrooms.noteClosed")}</Text>
                </View>
                <View className="flex-row gap-2 rounded-2xl border border-blue-200 dark:border-blue-300/30 bg-blue-50 dark:bg-blue-300/10 p-3">
                  <Icon name="information-circle" size={16} color="#1D4ED8" />
                  <Text className="flex-1 text-[12px] leading-[17px] text-blue-900 dark:text-blue-100">{t("classrooms.noteStudy")}</Text>
                </View>
              </View>
              <Text className="mt-2 text-sm text-gray-500 dark:text-gray-300" accessibilityLiveRegion="polite">
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
