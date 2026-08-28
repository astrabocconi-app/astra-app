import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import Svg, { Polyline, Circle, Path } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";

const BRAND = "#04107E";

// Simple week line chart of daily scans — built with react-native-svg (no dep).
function WeekChart({ data }: { data: { date: string; count: number }[] }) {
  const { width } = useWindowDimensions();
  const W = width - 40 - 32; // screen px-5 (2×20) + card p-4 (2×16)
  const H = 150;
  const padT = 18;
  const padB = 8;
  const padX = 6;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.count));
  const x = (i: number) => padX + ((W - 2 * padX) * i) / Math.max(1, n - 1);
  const y = (c: number) => padT + (1 - c / max) * (H - padT - padB);
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.count) }));
  if (pts.length === 0) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area =
    `M ${first.x},${H} ` + pts.map((p) => `L ${p.x},${p.y}`).join(" ") + ` L ${last.x},${H} Z`;
  const label = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "short" });

  return (
    <View>
      <Svg width={W} height={H}>
        <Path d={area} fill={BRAND} opacity={0.08} />
        <Polyline points={line} fill="none" stroke={BRAND} strokeWidth={2.5} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={BRAND} />
        ))}
      </Svg>
      <View style={{ width: W }} className="mt-1 flex-row justify-between">
        {data.map((d, i) => (
          <View key={i} className="items-center">
            <Text className="text-sm font-semibold text-gray-800">{d.count}</Text>
            <Text className="text-[10px] uppercase text-gray-400">{label(d.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Partner venue home — how many codes this venue has scanned.
export default function PartnerHomeScreen() {
  const t = useT();
  const stats = useQuery({
    queryKey: ["partner-stats"],
    queryFn: () => api.partner.stats(),
    retry: false,
    refetchInterval: 15_000,
  });

  const s = stats.data;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, paddingTop: 12 }}>
      <Text className="text-sm font-medium text-gray-500">{t("partnerHome.welcomeBack")}</Text>
      <Text className="text-3xl font-bold text-astra-primary">
        {s?.partner.name ?? t("partnerHome.partnerFallback")}
      </Text>

      {/* Big scans-today card */}
      <Pressable
        className="mt-6 rounded-3xl bg-astra-primary p-6 active:opacity-90"
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

      {/* This week — daily scans line chart */}
      <View className="mt-4 rounded-2xl border border-gray-100 p-4">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t("partnerHome.scansThisWeek")}
        </Text>
        {s?.scansByDay ? <WeekChart data={s.scansByDay} /> : <ActivityIndicator className="my-8" />}
      </View>

      {/* Scans all-time */}
      <View className="mt-4 rounded-2xl border border-gray-100 p-4">
        <Text className="text-xs uppercase tracking-wide text-gray-400">
          {t("partnerHome.scansAllTime")}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">
          {stats.isLoading ? "…" : (s?.scansTotal ?? 0)}
        </Text>
      </View>

      {/* Which promotion the scans were actually for. Shown only when the venue
          runs more than one — with a single offer the split says nothing the
          all-time total doesn't already. */}
      {s?.perOffer && s.perOffer.length > 1 && (
        <View className="mt-4 rounded-2xl border border-gray-100 p-4">
          <Text className="text-xs uppercase tracking-wide text-gray-400">
            {t("partnerHome.byOffer")}
          </Text>
          <View className="mt-3 gap-2.5">
            {s.perOffer.map((o) => {
              // Share of attributed scans, so the bars compare like with like.
              const attributed = s.perOffer.reduce((n, x) => n + x.scans, 0);
              const pct = attributed > 0 ? Math.round((o.scans / attributed) * 100) : 0;
              return (
                <View key={o.offerId} className="gap-1">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-[13px] text-gray-700" numberOfLines={1}>
                      {o.title}
                    </Text>
                    <Text className="text-[13px] font-semibold text-gray-900">{o.scans}</Text>
                  </View>
                  <View className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <View
                      className="h-full rounded-full bg-astra-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
          {s.unattributed > 0 && (
            <Text className="mt-3 text-[11px] text-gray-400">
              {t("partnerHome.unattributed", { count: String(s.unattributed) })}
            </Text>
          )}
        </View>
      )}

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
