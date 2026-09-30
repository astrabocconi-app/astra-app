import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Icon } from "../components/Icon";
import { useT } from "../lib/i18n";

// ASTRA Polare — the press section. Empty until the articles source is wired in.
export default function PolareScreen() {
  const t = useT();
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <View className="flex-row items-center gap-2 border-b border-gray-100 dark:border-white/10 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Icon name="chevron-back" size={26} color="#04107E" />
        </Pressable>
        <Text className="text-lg font-semibold text-astra-primary dark:text-white">{t("polare.title")}</Text>
      </View>
      <View className="flex-1 items-center justify-center px-10">
        <Text className="text-center text-gray-400 dark:text-white/60">{t("polare.empty")}</Text>
      </View>
    </SafeAreaView>
  );
}
