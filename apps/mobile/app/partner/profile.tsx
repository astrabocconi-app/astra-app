import { View, Text, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { clearToken } from "../../lib/session";
import { useT } from "../../lib/i18n";

export default function PartnerProfileScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
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
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary p-5" edges={["top"]}>
      <View className="items-center gap-3 pt-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-astra-light dark:bg-white/10">
          <Icon name="storefront" size={36} color="#04107E" />
        </View>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white">
          {stats.data?.partner.name ?? t("partnerProfile.partnerVenueFallback")}
        </Text>
        <Text className="rounded-full bg-astra-light dark:bg-white/10 px-3 py-1 text-xs font-medium text-astra-primary dark:text-white">
          {t("partnerProfile.partnerVenueBadge")}
        </Text>
      </View>

      <View className="flex-1" />

      <Pressable
        className="flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/15 px-4 py-3"
        style={{ marginBottom: insets.bottom + 80 }}
        onPress={signOut}
      >
        <Icon name="log-out-outline" size={20} color="#dc2626" />
        <Text className="font-semibold text-red-600">{t("common.signOut")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
