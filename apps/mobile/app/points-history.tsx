import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import { useLocale, useT } from "../lib/i18n";
import { useRefresh } from "../lib/use-refresh";

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function PointsHistoryScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["points-history"],
    queryFn: () => api.points.history(),
    retry: false,
  });
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const refresh = useRefresh(refetch);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("pointsHistory.title")} />

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      )}

      {error && (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => refetch() }}
        />
      )}

      {data && (
        <FlatList
          data={data.entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 8, flexGrow: 1 }}
          refreshControl={<RefreshControl {...refresh} />}
          ListEmptyComponent={<EmptyState icon="sparkles-outline" title={t("pointsHistory.empty")} />}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4">
              <View className="flex-1 pr-3">
                <Text className="font-medium text-gray-900 dark:text-white">{item.reason}</Text>
                {/* The source is a raw server enum, so only the date is shown. */}
                <Text className="mt-0.5 text-xs text-gray-400 dark:text-white/60">
                  {formatDate(item.createdAt, locale)}
                </Text>
              </View>
              <Text
                className={`text-base font-semibold ${
                  item.delta >= 0 ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"
                }`}
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
