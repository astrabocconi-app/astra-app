import { View, Text, ScrollView, Image, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

export default function RewardsScreen() {
  const rewards = useQuery({ queryKey: ["rewards"], queryFn: () => api.rewards.list(), retry: false });
  const balance = useQuery({ queryKey: ["points-balance"], queryFn: () => api.points.balance(), retry: false });
  const items = rewards.data?.items ?? [];
  const points = balance.data?.balance ?? 0;

  if (rewards.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, gap: 14 }}>
      {/* Balance banner */}
      <View className="flex-row items-center justify-between rounded-2xl bg-astra-primary px-5 py-4">
        <View>
          <Text className="text-xs uppercase tracking-wide text-white/70">Your points</Text>
          <Text className="mt-0.5 text-2xl font-bold text-white">{points.toLocaleString()}</Text>
        </View>
        <Ionicons name="gift" size={26} color="rgba(255,255,255,0.85)" />
      </View>

      {items.length === 0 ? (
        <View className="mt-10 items-center gap-3 px-4">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light">
            <Ionicons name="gift-outline" size={30} color="#04107E" />
          </View>
          <Text className="text-xl font-semibold text-astra-primary">No rewards yet</Text>
          <Text className="text-center text-gray-500">
            Rewards you can unlock with your points will appear here.
          </Text>
        </View>
      ) : (
        items.map((r) => {
          const affordable = points >= r.costPoints;
          return (
            <View
              key={r.id}
              className="flex-row items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4"
              style={{
                shadowColor: "#04107E",
                shadowOpacity: 0.06,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              {r.imageUrl ? (
                <Image source={{ uri: r.imageUrl }} resizeMode="cover" style={{ width: 64, height: 64, borderRadius: 14 }} />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light">
                  <Ionicons name="gift-outline" size={26} color="#04107E" />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{r.title}</Text>
                {r.description ? (
                  <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
                    {r.description}
                  </Text>
                ) : null}
                <Text className={`mt-1 text-xs font-medium ${affordable ? "text-green-600" : "text-gray-400"}`}>
                  {affordable ? "You can redeem this" : `${(r.costPoints - points).toLocaleString()} more points`}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-lg font-bold text-astra-primary">{r.costPoints.toLocaleString()}</Text>
                <Text className="text-[11px] text-gray-400">points</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
