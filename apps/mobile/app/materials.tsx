import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useProfileStore, shortCourse } from "../lib/profile-store";

const ALL_MATERIALS_URL = "https://www.astrabocconi.com/dispense";
const YEAR_ORDER = ["First Year", "Second Year", "Third Year", "Fourth Year", "Fifth Year"];

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
  const { course, hydrated, hydrate } = useProfileStore();
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const myCourse = shortCourse(course);
  const q = useQuery({ queryKey: ["materials"], queryFn: () => api.materials.list(), retry: 1 });

  // Flatten this student's course into a single list carrying year + semester.
  const mine = useMemo<FlatItem[]>(() => {
    if (!myCourse || !q.data) return [];
    const out: FlatItem[] = [];
    for (const y of q.data.years) {
      for (const s of y.subjects) {
        if (s.subject !== myCourse) continue;
        for (const it of s.items) {
          out.push({ ...it, year: y.year });
        }
      }
    }
    return out;
  }, [q.data, myCourse]);

  const availYears = useMemo(
    () => YEAR_ORDER.filter((y) => mine.some((it) => it.year === y)),
    [mine],
  );
  const availSemesters = useMemo(
    () => [...new Set(mine.map((it) => it.semester).filter(Boolean))].sort() as string[],
    [mine],
  );

  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [semFilter, setSemFilter] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      mine.filter(
        (it) =>
          (!yearFilter || it.year === yearFilter) && (!semFilter || it.semester === semFilter),
      ),
    [mine, yearFilter, semFilter],
  );

  // Group filtered items by year for display.
  const grouped = useMemo(() => {
    const byYear = new Map<string, FlatItem[]>();
    for (const it of filtered) {
      if (!byYear.has(it.year)) byYear.set(it.year, []);
      byYear.get(it.year)!.push(it);
    }
    return [...byYear.entries()].sort(
      (a, b) => YEAR_ORDER.indexOf(a[0]) - YEAR_ORDER.indexOf(b[0]),
    );
  }, [filtered]);

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
      className={`rounded-full px-3 py-1.5 ${active ? "bg-astra-primary" : "bg-astra-light"}`}
    >
      <Text className={`text-xs font-semibold ${active ? "text-white" : "text-astra-primary"}`}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-2 border-b border-gray-100 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#04107E" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-astra-primary">Materials</Text>
          <Text className="text-xs text-gray-400">
            {myCourse ? `${myCourse} handouts` : "Your course handouts"}
          </Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL(ALL_MATERIALS_URL)}
          className="flex-row items-center gap-1 rounded-full border border-astra-primary/20 px-3 py-1.5 active:opacity-70"
        >
          <Text className="text-xs font-semibold text-astra-primary">See all</Text>
          <Ionicons name="open-outline" size={13} color="#04107E" />
        </Pressable>
      </View>

      {!myCourse ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="school-outline" size={30} color="#9CA3AF" />
          <Text className="text-center text-gray-600">
            Set your course in your profile to see your handouts here.
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            className="mt-1 rounded-full bg-astra-primary px-5 py-2"
          >
            <Text className="font-medium text-white">Go to profile</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(ALL_MATERIALS_URL)} className="mt-1">
            <Text className="text-sm font-medium text-astra-primary underline">
              Or browse all materials
            </Text>
          </Pressable>
        </View>
      ) : q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#04107E" />
        </View>
      ) : q.isError ? (
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Ionicons name="cloud-offline-outline" size={28} color="#9CA3AF" />
          <Text className="text-center text-gray-500">Couldn't load materials.</Text>
          <Pressable onPress={() => q.refetch()} className="mt-2 rounded-full bg-astra-primary px-5 py-2">
            <Text className="font-medium text-white">Retry</Text>
          </Pressable>
        </View>
      ) : mine.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-gray-500">
            No handouts for {myCourse} yet.
          </Text>
          <Pressable onPress={() => Linking.openURL(ALL_MATERIALS_URL)} className="rounded-full bg-astra-primary px-5 py-2">
            <Text className="font-medium text-white">See all materials</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Filters */}
          {(availYears.length > 1 || availSemesters.length > 1) && (
            <View className="gap-2 px-4 py-3">
              {availYears.length > 1 && (
                <View className="flex-row flex-wrap gap-2">
                  <Chip label="All years" active={!yearFilter} onPress={() => setYearFilter(null)} />
                  {availYears.map((y) => (
                    <Chip
                      key={y}
                      label={y.replace(" Year", "")}
                      active={yearFilter === y}
                      onPress={() => setYearFilter(y)}
                    />
                  ))}
                </View>
              )}
              {availSemesters.length > 1 && (
                <View className="flex-row flex-wrap gap-2">
                  <Chip label="All sems" active={!semFilter} onPress={() => setSemFilter(null)} />
                  {availSemesters.map((s) => (
                    <Chip
                      key={s}
                      label={`Sem ${s}`}
                      active={semFilter === s}
                      onPress={() => setSemFilter(s)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}>
            {grouped.map(([year, items]) => (
              <View key={year}>
                <Text className="mb-1.5 text-sm font-bold uppercase tracking-wide text-astra-primary">
                  {year}
                </Text>
                <View className="gap-1.5">
                  {items.map((it) => (
                    <Pressable
                      key={String(it.id)}
                      onPress={() => Linking.openURL(it.url)}
                      className="flex-row items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 active:opacity-70"
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-lg bg-astra-light">
                        <Ionicons name="document-text-outline" size={18} color="#04107E" />
                      </View>
                      <View className="flex-1">
                        <Text numberOfLines={2} className="text-[13px] font-medium text-gray-900">
                          {it.title.replace(/\.pdf$/i, "")}
                        </Text>
                        {(it.semester || it.examType) && (
                          <Text className="text-[11px] text-gray-400">
                            {[it.examType, it.semester ? `Sem ${it.semester}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="download-outline" size={18} color="#04107E" />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Pressable
              onPress={() => Linking.openURL(ALL_MATERIALS_URL)}
              className="mt-2 flex-row items-center justify-center gap-2 rounded-xl border border-astra-primary/20 py-3 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-astra-primary">See all materials</Text>
              <Ionicons name="open-outline" size={15} color="#04107E" />
            </Pressable>
            <View className="h-6" />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
