import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { ScanChart, seriesColor } from "../../components/ScanChart";
import { SegmentedToggle } from "../../components/SegmentedToggle";

type RangeDays = 7 | 14 | 30 | 90;

// Partner venue home — how many codes this venue has scanned.
export default function PartnerHomeScreen() {
  const t = useT();
  const [days, setDays] = useState<RangeDays>(7);
  const stats = useQuery({
    queryKey: ["partner-stats", days],
    queryFn: () => api.partner.stats(days),
    retry: false,
    refetchInterval: 15_000,
  });

  const s = stats.data;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-astra-primary" contentContainerStyle={{ padding: 20, paddingTop: 12 }}>
      <Text className="text-sm font-medium text-gray-500 dark:text-gray-300">{t("partnerHome.welcomeBack")}</Text>
      <Text className="text-3xl font-bold text-astra-primary dark:text-white">
        {s?.partner.name ?? t("partnerHome.partnerFallback")}
      </Text>

      {/* Big scans-today card */}
      <Pressable
        className="mt-6 rounded-3xl bg-astra-primary dark:bg-astra-dark p-6 active:opacity-90"
        onPress={() => router.push("/partner/scan")}
      >
        <Text className="text-xs uppercase tracking-wide text-white/70">
          {t("partnerHome.codesScannedToday")}
        </Text>
        <Text className="mt-1 text-6xl font-bold text-white">
          {stats.isLoading ? "…" : (s?.scansToday ?? 0)}
        </Text>
        <View className="mt-3 flex-row items-center gap-1.5">
          <Ionicons name="camera" size={16} color="rgba(255,255,255,0.85)" />
          <Text className="text-sm text-white/80">{t("partnerHome.tapToScan")}</Text>
        </View>
      </Pressable>

      {/* Range picker */}
      <View className="mt-5">
        <SegmentedToggle
          value={String(days)}
          onChange={(v) => setDays(Number(v) as RangeDays)}
          options={[
            { value: "7", label: t("partnerHome.range1w") },
            { value: "14", label: t("partnerHome.range2w") },
            { value: "30", label: t("partnerHome.range1m") },
            { value: "90", label: t("partnerHome.range3m") },
          ]}
        />
      </View>

      {/* Scans over time, stacked by promotion */}
      <View className="mt-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
        <View className="mb-3 flex-row items-baseline justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
            {t("partnerHome.scansOverTime")}
          </Text>
          <Text className="text-lg font-bold text-gray-900 dark:text-white">{s?.scansInRange ?? 0}</Text>
        </View>

        {s ? (
          <ScanChart buckets={s.buckets} series={s.series} bucket={s.range.bucket} />
        ) : (
          <ActivityIndicator className="my-8" />
        )}

        {/* Legend doubles as the table view: the lighter hues fall below 3:1 on
            white, so identity is never left to colour alone. */}
        {s && s.series.length > 0 && (
          <View className="mt-4 gap-2">
            {s.series.map((series, i) => (
              <View key={series.offerId ?? "none"} className="flex-row items-center gap-2">
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: seriesColor(series, i),
                  }}
                />
                <Text className="flex-1 text-[13px] text-gray-700 dark:text-gray-200" numberOfLines={1}>
                  {series.offerId === null ? t("partnerHome.noOfferSeries") : series.title}
                </Text>
                <Text className="text-[13px] font-semibold text-gray-900 dark:text-white">{series.total}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Scans all-time */}
      <View className="mt-4 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
        <Text className="text-xs uppercase tracking-wide text-gray-400 dark:text-white/60">
          {t("partnerHome.scansAllTime")}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {stats.isLoading ? "…" : (s?.scansTotal ?? 0)}
        </Text>
      </View>

      {stats.isError && (
        <View className="mt-6 items-center gap-2">
          <Text className="text-red-600">{t("partnerHome.loadStatsError")}</Text>
          <Pressable
            className="rounded-lg border border-gray-300 px-4 py-2"
            onPress={() => stats.refetch()}
          >
            <Text>{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {stats.isLoading && !s && <ActivityIndicator className="mt-6" />}
    </ScrollView>
  );
}
