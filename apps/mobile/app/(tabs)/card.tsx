import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

// The student's loyalty card: a QR encoding a signed token. Partner venues scan
// it to award points. Refreshes periodically so the token stays current.
export default function CardScreen() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const card = useQuery({
    queryKey: ["card-token"],
    queryFn: () => api.card.token(),
    retry: false,
    refetchInterval: 60_000,
  });

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-2xl font-bold text-astra-primary">Your ASTRA Card</Text>
        <Text className="mt-2 text-center text-gray-500">
          Show this at partner venues to earn points on your purchases.
        </Text>

        <View
          className="mt-10 items-center justify-center rounded-3xl border border-gray-100 bg-white p-7"
          style={{
            width: 288,
            height: 288,
            shadowColor: "#04107E",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          {card.isLoading ? (
            <ActivityIndicator />
          ) : card.data ? (
            <QRCode value={card.data.token} size={224} color="#04107E" backgroundColor="#fff" />
          ) : (
            <View className="items-center gap-2">
              <Ionicons name="cloud-offline-outline" size={28} color="#9CA3AF" />
              <Text className="text-center text-gray-400">Couldn't load your card.</Text>
            </View>
          )}
        </View>

        <Text className="mt-8 text-lg font-semibold text-gray-900">
          {me.data?.name ?? "Member"}
        </Text>
        <Text className="text-sm text-gray-400">{me.data?.email ?? ""}</Text>
      </View>
    </SafeAreaView>
  );
}
