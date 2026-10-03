import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { Icon, Spinner } from "../../components/Icon";
import { api } from "../../lib/api";
import { saveCardToken, loadCardToken } from "../../lib/session";
import { useT } from "../../lib/i18n";

// The student's loyalty card: a QR encoding a signed token. Partner venues scan
// it to award points. It refreshes periodically while online, and the last token
// is cached so the card still renders offline.
export default function CardScreen() {
  const t = useT();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const card = useQuery({
    queryKey: ["card-token"],
    queryFn: () => api.card.token(),
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
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-2xl font-semibold text-gray-900 dark:text-white">{t("card.title")}</Text>
        <Text className="mt-2 text-center text-gray-500 dark:text-gray-300">
          {t("card.subtitle")}
        </Text>

        <View
          className="mt-10 items-center justify-center rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-7"
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
              // Metro resolves bundled image assets through CommonJS.
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              logo={require("../../assets/logo-icon.png")}
              logoSize={52}
              logoBackgroundColor="#fff"
              logoBorderRadius={10}
              logoMargin={4}
            />
          ) : card.isLoading ? (
            <Spinner />
          ) : (
            <View className="items-center gap-2">
              <Icon name="cloud-offline-outline" size={28} color="#9CA3AF" />
              <Text className="text-center text-gray-400 dark:text-white/60">{t("card.loadError")}</Text>
              <Pressable
                onPress={() => card.refetch()}
                accessibilityRole="button"
                className="mt-1 rounded-xl bg-astra-primary dark:bg-white/15 px-5 py-2.5 active:opacity-80"
              >
                <Text className="text-sm font-semibold text-white">{t("common.retry")}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text className="mt-8 text-lg font-semibold text-gray-900 dark:text-white">
          {me.data?.name ?? t("card.memberFallback")}
        </Text>

        {/* Reassurance: the code refreshes on its own and works without signal.
            Only once there is a code, or it contradicts the error above. */}
        {token ? (
          <>
            <View className="mt-4 flex-row items-center gap-1.5">
              <Icon name="refresh" size={13} color="#9CA3AF" />
              <Text className="text-xs text-gray-400 dark:text-white/60">{t("card.autoRefresh")}</Text>
            </View>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Icon name="cloud-offline-outline" size={13} color="#9CA3AF" />
              <Text className="text-xs text-gray-400 dark:text-white/60">{t("card.worksOffline")}</Text>
            </View>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
