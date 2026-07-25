import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { saveCardToken, loadCardToken } from "../../lib/session";

// The student's loyalty card: a QR encoding a signed token. Partner venues scan
// it to award points. It refreshes periodically while online, and the last token
// is cached so the card still renders offline.
export default function CardScreen() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const card = useQuery({
    queryKey: ["card-token"],
    queryFn: () => api.card.token(),
    retry: false,
    refetchInterval: 60_000,
  });

  // Offline fallback: hydrate the last cached token on mount, and persist every
  // fresh token so the QR is available without a connection.
  const [cachedToken, setCachedToken] = useState<string | null>(null);
  useEffect(() => {
    loadCardToken().then(setCachedToken);
  }, []);
  useEffect(() => {
    if (card.data?.token) {
      setCachedToken(card.data.token);
      void saveCardToken(card.data.token);
    }
  }, [card.data?.token]);

  const token = card.data?.token ?? cachedToken;

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
          {token ? (
            <QRCode
              value={token}
              size={224}
              color="#04107E"
              backgroundColor="#fff"
              logo={require("../../assets/logo-icon.png")}
              logoSize={52}
              logoBackgroundColor="#fff"
              logoBorderRadius={10}
              logoMargin={4}
            />
          ) : card.isLoading ? (
            <ActivityIndicator />
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

        {/* Reassurance: the code refreshes on its own and works without signal. */}
        <View className="mt-4 flex-row items-center gap-1.5">
          <Ionicons name="refresh" size={13} color="#9CA3AF" />
          <Text className="text-xs text-gray-400">Refreshes automatically — no need to screenshot</Text>
        </View>
        <View className="mt-1 flex-row items-center gap-1.5">
          <Ionicons name="cloud-offline-outline" size={13} color="#9CA3AF" />
          <Text className="text-xs text-gray-400">Works offline</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
