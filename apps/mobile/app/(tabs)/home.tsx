import { View, Text, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

export default function HomeScreen() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const balance = useQuery({
    queryKey: ["points-balance"],
    queryFn: () => api.points.balance(),
    retry: false,
  });

  const firstName = me.data?.name?.split(" ")[0];

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text className="text-2xl font-bold text-astra-primary">
        {me.isLoading ? "…" : firstName ? `Ciao, ${firstName}` : "Welcome to ASTRA"}
      </Text>

      {/* Points balance — tap for history */}
      <Pressable
        className="rounded-2xl bg-astra-primary p-5 active:opacity-90"
        onPress={() => router.push("/points-history")}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xs uppercase tracking-wide text-white/70">Your points</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
        </View>
        <Text className="mt-1 text-4xl font-bold text-white">
          {balance.isLoading ? "…" : balance.data ? balance.data.balance.toLocaleString() : "0"}
        </Text>
        <Text className="mt-1 text-xs text-white/60">Tap to see history</Text>
      </Pressable>

      {/* News — filled in Phase 9 */}
      <Text className="mt-2 text-lg font-semibold text-gray-900">News</Text>
      <View className="items-center gap-2 rounded-2xl border border-gray-200 p-8">
        <Ionicons name="newspaper-outline" size={28} color="#9CA3AF" />
        <Text className="text-center text-gray-400">No announcements yet.</Text>
      </View>
    </ScrollView>
  );
}
