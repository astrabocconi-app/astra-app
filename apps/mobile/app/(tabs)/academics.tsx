import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../../lib/i18n";

/**
 * Placeholder for the Academics section.
 *
 * The tab is deliberately not tappable yet (see the tabs layout), so this
 * screen isn't reachable in normal use — it exists because expo-router builds
 * its route table from the filesystem, and it keeps the section ready to fill
 * in without touching navigation again.
 */
export default function AcademicsScreen() {
  const t = useT();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white px-10">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light">
        <Ionicons name="school-outline" size={30} color="#04107E" />
      </View>
      <Text className="text-xl font-semibold text-astra-primary">{t("academics.title")}</Text>
      <Text className="text-center text-gray-500">{t("academics.comingSoonBody")}</Text>
    </View>
  );
}
