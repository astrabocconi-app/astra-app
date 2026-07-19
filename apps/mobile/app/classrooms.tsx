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
import { api } from "../lib/api";

// Free@B — live Bocconi free-classroom availability, rendered natively.
export default function ClassroomsScreen() {
  const [building, setBuilding] = useState("all");
  const [studyOnly, setStudyOnly] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => api.classrooms.list(),
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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-gray-100 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#04107E" />
        </Pressable>
        <View>
          <Text className="text-lg font-semibold text-astra-primary">Free classrooms</Text>
          <Text className="text-xs text-gray-400">Live availability · Free@B</Text>
        </View>
      </View>

      {/* Filters */}
      <View className="border-b border-gray-100 pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}
        >
          {["all", ...buildings].map((b) => {
            const active = building === b;
            return (
              <Pressable
                key={b}
                onPress={() => setBuilding(b)}
                className={`rounded-full px-4 py-1.5 ${active ? "bg-astra-primary" : "bg-gray-100"}`}
              >
                <Text className={active ? "font-medium text-white" : "text-gray-600"}>
                  {b === "all" ? "All buildings" : b}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
          <Text className="text-sm text-gray-700">Study rooms (aule studio) only</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-red-600">{String((error as Error).message)}</Text>
          <Pressable className="rounded-lg border border-gray-300 px-4 py-3" onPress={() => refetch()}>
            <Text>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r, i) => `${r.building}-${r.name}-${i}`}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          ListHeaderComponent={
            <Text className="mb-1 text-sm text-gray-500">
              {visible.length} free {visible.length === 1 ? "room" : "rooms"}
              {building !== "all" ? ` in ${building}` : ""}
            </Text>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-2 px-10 pt-24">
              <Ionicons name="calendar-outline" size={34} color="#9CA3AF" />
              <Text className="text-center text-base font-semibold text-gray-700">
                Not available yet
              </Text>
              <Text className="text-center text-sm leading-5 text-gray-400">
                Live classroom availability is read from Bocconi&apos;s timetable, which has no
                data right now (weekends and outside term). This will start working
                automatically once the semester begins.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                  {item.isStudyRoom && (
                    <Text className="rounded-full bg-astra-light px-2 py-0.5 text-[10px] font-medium text-astra-primary">
                      STUDY
                    </Text>
                  )}
                </View>
                <Text className="mt-0.5 text-xs text-gray-400">{item.building}</Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center gap-1">
                  <View className="h-2 w-2 rounded-full bg-green-500" />
                  <Text className="text-sm font-medium text-green-600">Free</Text>
                </View>
                {item.freeUntil && (
                  <Text className="mt-0.5 text-xs text-gray-400">until {item.freeUntil}</Text>
                )}
              </View>
            </View>
          )}
          ListFooterComponent={
            <Text className="mt-4 px-2 text-center text-[11px] leading-4 text-gray-400">
              Rooms may close for cleaning or events. Times include a 15-min buffer before the
              next class. Weekend/off-term data can be incomplete. Powered by Free@B.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
