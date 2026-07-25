import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { clearToken } from "../../lib/session";

export default function PartnerProfileScreen() {
  const qc = useQueryClient();
  const stats = useQuery({
    queryKey: ["partner-stats"],
    queryFn: () => api.partner.stats(),
    retry: false,
  });

  async function signOut() {
    await clearToken();
    qc.clear();
    router.replace("/");
  }

  return (
    <SafeAreaView className="flex-1 bg-white p-5" edges={["top"]}>
      <View className="items-center gap-3 pt-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-astra-light">
          <Ionicons name="storefront" size={36} color="#04107E" />
        </View>
        <Text className="text-xl font-semibold text-gray-900">
          {stats.data?.partner.name ?? "Partner venue"}
        </Text>
        <Text className="rounded-full bg-astra-light px-3 py-1 text-xs font-medium text-astra-primary">
          PARTNER VENUE
        </Text>
      </View>

      <View className="flex-1" />

      <Pressable
        className="flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3"
        onPress={signOut}
      >
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text className="font-semibold text-red-600">Log out</Text>
      </Pressable>
    </SafeAreaView>
  );
}
