import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

export default function HomeScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const firstName = data?.name?.split(" ")[0];

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text className="text-2xl font-bold text-astra-primary">
        {isLoading ? "…" : firstName ? `Ciao, ${firstName}` : "Welcome to ASTRA"}
      </Text>

      {/* Points balance — filled in Phase 4 (points engine) */}
      <View className="rounded-2xl bg-astra-primary p-5">
        <Text className="text-xs uppercase tracking-wide text-white/70">Your points</Text>
        <Text className="mt-1 text-4xl font-bold text-white">—</Text>
        <Text className="mt-1 text-xs text-white/60">Coming soon</Text>
      </View>

      {/* News — filled in Phase 9 */}
      <Text className="mt-2 text-lg font-semibold text-gray-900">News</Text>
      <View className="items-center gap-2 rounded-2xl border border-gray-200 p-8">
        <Ionicons name="newspaper-outline" size={28} color="#9CA3AF" />
        <Text className="text-center text-gray-400">No announcements yet.</Text>
      </View>
    </ScrollView>
  );
}
