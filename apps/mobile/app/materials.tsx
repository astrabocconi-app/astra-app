import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking, Alert, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import { useT, type TranslationKey } from "../lib/i18n";
import { useRefresh } from "../lib/use-refresh";

const ALL_MATERIALS_URL = "https://www.astrabocconi.com/dispense";
const YEAR_ORDER = ["First Year", "Second Year", "Third Year", "Fourth Year", "Fifth Year"];

// Maps the API's (English) year values to translation keys — the values
// themselves stay in YEAR_ORDER/matching logic untouched since they must
// match what the backend returns.
const YEAR_FULL_KEYS: Record<string, TranslationKey> = {
  "First Year": "materials.yearFirstFull",
  "Second Year": "materials.yearSecondFull",
  "Third Year": "materials.yearThirdFull",
  "Fourth Year": "materials.yearFourthFull",
  "Fifth Year": "materials.yearFifthFull",
};
const YEAR_SHORT_KEYS: Record<string, TranslationKey> = {
  "First Year": "materials.yearFirstShort",
  "Second Year": "materials.yearSecondShort",
  "Third Year": "materials.yearThirdShort",
  "Fourth Year": "materials.yearFourthShort",
  "Fifth Year": "materials.yearFifthShort",
};

type FlatItem = {
  id: string | number;
  title: string;
  url: string;
  year: string;
  semester?: string | null;
  examType?: string | null;
};

// Handouts (dispense) live in Supabase. This screen shows ONLY the student's own
// course, filterable by year and semester, and links straight to each file —
// nothing is bundled. Everything else lives on the ASTRA website (see-all link).
export default function MaterialsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const myCourse = me.data?.academicProfile?.programme.code ?? null;
  // Students revisit earlier years when resitting or revising, and look ahead
  // before picking electives, so the whole programme is one tap away.
  const [allYears, setAllYears] = useState(false);
  const q = useQuery({
    queryKey: ["materials", allYears],
    queryFn: () => api.materials.list({ allYears }),
    retry: 1,
    enabled: Boolean(myCourse),
  });
  const refresh = useRefresh(q.refetch);

  // Flatten this student's course into a single list carrying year + semester.
  const mine = useMemo<FlatItem[]>(() => {
    if (!myCourse || !q.data) return [];
    const out: FlatItem[] = [];
    for (const y of q.data.years) {
      for (const s of y.subjects) {
        for (const it of s.items) {
          out.push({ ...it, year: y.year });
        }
      }
    }
    return out;
  }, [q.data, myCourse]);

  const availYears = useMemo(
    () => YEAR_ORDER.filter((y) => mine.some((it) => it.year === y)),
    [mine]
  );
  const availSemesters = useMemo(
    () => [...new Set(mine.map((it) => it.semester).filter(Boolean))].sort() as string[],
    [mine]
  );

  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [semFilter, setSemFilter] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      mine.filter(
        (it) => (!yearFilter || it.year === yearFilter) && (!semFilter || it.semester === semFilter)
      ),
    [mine, yearFilter, semFilter]
  );

  // Group filtered items by year for display.
  const grouped = useMemo(() => {
    const byYear = new Map<string, FlatItem[]>();
    for (const it of filtered) {
      if (!byYear.has(it.year)) byYear.set(it.year, []);
      byYear.get(it.year)!.push(it);
    }
    return [...byYear.entries()].sort(
      (a, b) => YEAR_ORDER.indexOf(a[0]) - YEAR_ORDER.indexOf(b[0])
    );
  }, [filtered]);

  // Handout links are third-party URLs; a dead one gets a message, not silence.
  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody"));
    }
  }

  const Chip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      className={`rounded-full px-3.5 py-2 ${active ? "bg-astra-primary dark:bg-white" : "bg-gray-100 dark:bg-white/10"}`}
    >
      <Text
        className={`text-[13px] font-medium ${active ? "text-white dark:text-astra-primary" : "text-gray-700 dark:text-gray-200"}`}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader
        title={t("materials.title")}
        subtitle={myCourse ? t("materials.courseHandouts", { course: myCourse }) : t("materials.yourCourseHandouts")}
        right={
          <Pressable
            onPress={() => open(ALL_MATERIALS_URL)}
            hitSlop={8}
            className="mr-2 flex-row items-center gap-1 rounded-full border border-astra-primary/20 dark:border-white/15 px-3 py-1.5 active:opacity-70"
          >
            <Text className="text-xs font-semibold text-astra-primary dark:text-white">{t("materials.seeAll")}</Text>
            <Icon name="open-outline" size={13} color="#04107E" />
          </Pressable>
        }
      />

      {/* Scope: just my year, or the whole programme. Outside the result
          branches, so an empty year can still switch to the whole course. */}
      {myCourse ? (
        <View className="flex-row gap-2 px-4 pt-3">
          <Chip
            label={t("materials.myYear")}
            active={!allYears}
            onPress={() => {
              setAllYears(false);
              setYearFilter(null);
            }}
          />
          <Chip
            label={t("materials.allYearsOfCourse")}
            active={allYears}
            onPress={() => {
              setAllYears(true);
              setYearFilter(null);
            }}
          />
        </View>
      ) : null}

      {me.isLoading || (myCourse && q.isLoading) ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : !myCourse ? (
        <EmptyState
          icon="school-outline"
          title={t("materials.setCourseYear")}
          action={{ label: t("materials.goToProfile"), onPress: () => router.push("/profile") }}
        />
      ) : q.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("materials.loadError")}
          action={{ label: t("common.retry"), onPress: () => q.refetch() }}
        />
      ) : mine.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={t("materials.noHandoutsForCourse", { course: myCourse })}
          action={{ label: t("materials.seeAllMaterials"), onPress: () => open(ALL_MATERIALS_URL) }}
        />
      ) : (
        <>
          {/* Filters */}
          {(availYears.length > 1 || availSemesters.length > 1) && (
            <View className="gap-2 px-4 py-3">
              {availYears.length > 1 && (
                <View className="flex-row flex-wrap gap-2">
                  <Chip label={t("materials.allYears")} active={!yearFilter} onPress={() => setYearFilter(null)} />
                  {availYears.map((y) => (
                    <Chip
                      key={y}
                      label={t(YEAR_SHORT_KEYS[y]!)}
                      active={yearFilter === y}
                      onPress={() => setYearFilter(y)}
                    />
                  ))}
                </View>
              )}
              {availSemesters.length > 1 && (
                <View className="flex-row flex-wrap gap-2">
                  <Chip label={t("materials.allSems")} active={!semFilter} onPress={() => setSemFilter(null)} />
                  {availSemesters.map((s) => (
                    <Chip
                      key={s}
                      label={t("materials.semLabel", { sem: s })}
                      active={semFilter === s}
                      onPress={() => setSemFilter(s)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 16, gap: 16 }}
            refreshControl={<RefreshControl {...refresh} />}
          >
            {grouped.map(([year, items]) => (
              <View key={year}>
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
                  {t(YEAR_FULL_KEYS[year]!)}
                </Text>
                <View className="gap-1.5">
                  {items.map((it) => (
                    <Pressable
                      key={String(it.id)}
                      onPress={() => open(it.url)}
                      className="flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-3 active:opacity-70"
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-lg bg-astra-light dark:bg-white/10">
                        <Icon name="document-text-outline" size={18} color="#04107E" />
                      </View>
                      <View className="flex-1">
                        <Text numberOfLines={2} className="text-[13px] font-medium text-gray-900 dark:text-white">
                          {it.title.replace(/\.pdf$/i, "")}
                        </Text>
                        {(it.semester || it.examType) && (
                          <Text className="text-[11px] text-gray-400 dark:text-white/60">
                            {[it.examType, it.semester ? t("materials.semLabel", { sem: it.semester }) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        )}
                      </View>
                      {/* Opens in the browser, so the outbound arrow, not a download. */}
                      <Icon name="open-outline" size={18} color="#04107E" />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Pressable
              onPress={() => open(ALL_MATERIALS_URL)}
              className="mt-2 flex-row items-center justify-center gap-2 rounded-xl border border-astra-primary/20 dark:border-white/15 py-3 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-astra-primary dark:text-white">{t("materials.seeAllMaterials")}</Text>
              <Icon name="open-outline" size={15} color="#04107E" />
            </Pressable>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
