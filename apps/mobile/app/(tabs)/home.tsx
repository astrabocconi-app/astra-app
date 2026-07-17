import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

// Placeholder events until Phase 8 wires the real Events API.
const SAMPLE_EVENTS = [
  { id: "1", title: "Launch Night", date: "Sep 15", tint: "#04107E", icon: "sparkles" as const },
  { id: "2", title: "Aperitivo", date: "Sep 22", tint: "#3B4AD0", icon: "wine" as const },
  { id: "3", title: "Career Day", date: "Oct 3", tint: "#1E2A8A", icon: "briefcase" as const },
];

export default function HomeScreen() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const balance = useQuery({ queryKey: ["points-balance"], queryFn: () => api.points.balance(), retry: false });
  const history = useQuery({ queryKey: ["points-history"], queryFn: () => api.points.history(), retry: false });

  const firstName = me.data?.name?.split(" ")[0];
  const recent = history.data?.entries.slice(0, 3) ?? [];

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Branded header */}
      <View className="px-5 pt-2">
        <Image
          source={require("../../assets/logo-horizontal.png")}
          resizeMode="contain"
          style={{ width: 150, height: 40 }}
        />
        <Text className="mt-3 text-3xl font-bold text-gray-900">
          Welcome{firstName ? "," : ""}
        </Text>
        {firstName ? (
          <Text className="text-3xl font-bold text-astra-primary">{firstName} 👋</Text>
        ) : null}
      </View>

      {/* Latest events — horizontal squares */}
      <Text className="mt-6 px-5 text-lg font-semibold text-gray-900">Latest events</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 14 }}
      >
        {SAMPLE_EVENTS.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => router.push("/events")}
            className="overflow-hidden rounded-2xl"
            style={{ width: 150, height: 170 }}
          >
            <View style={{ flex: 1, backgroundColor: e.tint }} className="justify-between p-4">
              <Ionicons name={e.icon} size={26} color="rgba(255,255,255,0.9)" />
              <View>
                <Text className="text-base font-semibold text-white">{e.title}</Text>
                <Text className="mt-0.5 text-xs text-white/70">{e.date}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Your account */}
      <Text className="mt-4 px-5 text-lg font-semibold text-gray-900">Your account</Text>
      <View className="px-5 pt-3">
        {/* Points balance */}
        <Pressable
          className="rounded-2xl bg-astra-primary p-5 active:opacity-90"
          onPress={() => router.push("/points-history")}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-wide text-white/70">Your points</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </View>
          <Text className="mt-1 text-4xl font-bold text-white">
            {balance.isLoading ? "…" : (balance.data?.balance ?? 0).toLocaleString()}
          </Text>
          <Text className="mt-1 text-xs text-white/60">Tap to see history</Text>
        </Pressable>

        {/* Recent activity */}
        <View className="mt-3 rounded-2xl border border-gray-100 p-4">
          <Text className="mb-2 text-sm font-medium text-gray-500">Recent activity</Text>
          {recent.length === 0 ? (
            <Text className="py-2 text-center text-gray-400">No activity yet.</Text>
          ) : (
            recent.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between py-2">
                <Text className="flex-1 pr-3 text-gray-800" numberOfLines={1}>
                  {r.reason}
                </Text>
                <Text className={`font-semibold ${r.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {r.delta >= 0 ? "+" : ""}
                  {r.delta}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
