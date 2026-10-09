import { View, Pressable } from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { signOutAndReset } from "../../lib/sign-out";
import { useT } from "../../lib/i18n";

export default function PartnerProfileScreen() {
  const t = useT();
  const stats = useQuery({
    queryKey: ["partner-stats"],
    queryFn: () => api.partner.stats(),
  });

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary p-5" edges={["top"]}>
      <View className="items-center gap-3 pt-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-astra-light dark:bg-white/10">
          <Icon name="storefront" size={36} color="#04107E" />
        </View>
        <Text accessibilityRole="header" className="text-center text-xl font-semibold text-gray-900 dark:text-white">
          {stats.data?.partner.name ?? t("partnerProfile.partnerVenueFallback")}
        </Text>
        <Text className="rounded-full bg-astra-light dark:bg-white/10 px-3 py-1 text-xs font-medium text-astra-primary dark:text-white">
          {t("partnerProfile.partnerVenueBadge")}
        </Text>
      </View>

      <View className="flex-1" />

      <Pressable
        className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/15 px-4 py-3"
        // The tab scene already ends above the bar.
        style={{ marginBottom: 24 }}
        accessibilityRole="button"
        onPress={() => void signOutAndReset()}
      >
        <Icon name="log-out-outline" size={20} color="#B91C1C" />
        <Text chrome className="font-semibold text-red-700 dark:text-red-300">{t("common.signOut")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
