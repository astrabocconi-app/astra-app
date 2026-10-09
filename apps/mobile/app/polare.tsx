import { View, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ScreenHeader } from "../components/ScreenHeader";
import { Button } from "../components/Button";
import { Text } from "../components/AppText";
import { IMAGES } from "../lib/assets";
import { useT } from "../lib/i18n";

// Stella Polare — the press section. The articles source is not wired in yet, so
// this is a designed "coming soon" page rather than an empty list: the artwork
// from the Home tile, a badge, and a way back.
export default function PolareScreen() {
  const t = useT();
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("polare.title")} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Same blue as the artwork's own background, so it has no visible edge. */}
        <View className="items-center overflow-hidden rounded-3xl p-6" style={{ backgroundColor: "#04107E" }}>
          <Image
            source={IMAGES.stellaPolare}
            resizeMode="contain"
            style={{ width: "100%", height: 200 }}
            accessibilityIgnoresInvertColors
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>

        <View className="items-center gap-3">
          <Text
            maxFontSizeMultiplier={1.3}
            className="rounded-full bg-astra-light dark:bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-astra-primary dark:text-white"
          >
            {t("polare.badge")}
          </Text>
          <Text accessibilityRole="header" className="text-center text-2xl font-semibold text-gray-900 dark:text-white">
            {t("polare.comingTitle")}
          </Text>
          <Text className="text-center text-[15px] leading-6 text-gray-600 dark:text-gray-300">
            {t("polare.comingBody")}
          </Text>
        </View>

        <Button label={t("polare.cta")} onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
