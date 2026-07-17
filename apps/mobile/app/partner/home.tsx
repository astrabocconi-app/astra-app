import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

// Partner venue home — how many codes this venue has scanned.
export default function PartnerHomeScreen() {
  const stats = useQuery({
    queryKey: ["partner-stats"],
    queryFn: () => api.partner.stats(),
    retry: false,
    refetchInterval: 15_000,
  });

  const s = stats.data;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, paddingTop: 12 }}>
      <Text className="text-sm font-medium text-gray-500">Welcome back</Text>
      <Text className="text-3xl font-bold text-astra-primary">{s?.partner.name ?? "Partner"}</Text>

      {/* Big scans-today card */}
      <Pressable
        className="mt-6 rounded-3xl bg-astra-primary p-6 active:opacity-90"
        onPress={() => router.push("/partner/scan")}
      >
        <Text className="text-xs uppercase tracking-wide text-white/70">Codes scanned today</Text>
        <Text className="mt-1 text-6xl font-bold text-white">
          {stats.isLoading ? "…" : (s?.scansToday ?? 0)}
        </Text>
        <View className="mt-3 flex-row items-center gap-1.5">
          <Ionicons name="camera" size={16} color="rgba(255,255,255,0.85)" />
          <Text className="text-sm text-white/80">Tap to scan a member's card</Text>
        </View>
      </Pressable>

      {/* Secondary stats */}
      <View className="mt-4 flex-row gap-4">
        <View className="flex-1 rounded-2xl border border-gray-100 p-4">
          <Text className="text-xs uppercase tracking-wide text-gray-400">Points given today</Text>
          <Text className="mt-1 text-2xl font-bold text-gray-900">
            {stats.isLoading ? "…" : (s?.pointsToday ?? 0)}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl border border-gray-100 p-4">
          <Text className="text-xs uppercase tracking-wide text-gray-400">Scans all-time</Text>
          <Text className="mt-1 text-2xl font-bold text-gray-900">
            {stats.isLoading ? "…" : (s?.scansTotal ?? 0)}
          </Text>
        </View>
      </View>

      {stats.isError && (
        <View className="mt-6 items-center gap-2">
          <Text className="text-red-600">Couldn't load stats.</Text>
          <Pressable
            className="rounded-lg border border-gray-300 px-4 py-2"
            onPress={() => stats.refetch()}
          >
            <Text>Retry</Text>
          </Pressable>
        </View>
      )}

      {stats.isLoading && !s && <ActivityIndicator className="mt-6" />}
    </ScrollView>
  );
}
