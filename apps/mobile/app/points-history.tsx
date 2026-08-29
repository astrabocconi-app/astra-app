import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon } from "../components/Icon";
import { api } from "../lib/api";
import { useT } from "../lib/i18n";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function PointsHistoryScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["points-history"],
    queryFn: () => api.points.history(),
    retry: false,
  });
  const t = useT();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-gray-100 dark:border-white/10 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Icon name="chevron-back" size={26} color="#04107E" />
        </Pressable>
        <Text className="text-lg font-semibold text-astra-primary dark:text-white">{t("pointsHistory.title")}</Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      )}

      {error && (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-red-600">{String((error as Error).message)}</Text>
          <Pressable className="rounded-lg border border-gray-300 px-4 py-3" onPress={() => refetch()}>
            <Text>{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <FlatList
          data={data.entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <View className="items-center gap-2 pt-16">
              <Icon name="sparkles-outline" size={28} color="#9CA3AF" />
              <Text className="text-gray-400 dark:text-white/60">{t("pointsHistory.empty")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4">
              <View className="flex-1 pr-3">
                <Text className="font-medium text-gray-900 dark:text-white">{item.reason}</Text>
                <Text className="mt-0.5 text-xs uppercase tracking-wide text-gray-400 dark:text-white/60">
                  {item.source} · {formatDate(item.createdAt)}
                </Text>
              </View>
              <Text
                className={`text-base font-semibold ${item.delta >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {item.delta >= 0 ? "+" : ""}
                {item.delta}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
