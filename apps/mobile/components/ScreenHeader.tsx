import type { ReactNode } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Icon } from "./Icon";
import { Text } from "./AppText";
import { useT } from "../lib/i18n";
import { useAuthStore } from "../lib/auth-store";

/** Back, or home when this screen was opened cold (a deep link, a notification) and has nothing under it. */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace(useAuthStore.getState().accountType === "partner" ? "/partner/home" : "/home");
}

// The header every pushed screen uses: back chevron, title (+ subtitle), and
// an optional control on the right. Detail screens pass an empty title and
// put their own heading in the body.
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const t = useT();
  return (
    <View className="flex-row items-center gap-1 border-b border-gray-100 dark:border-white/10 px-2 py-2">
      <Pressable
        onPress={goBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        className="h-11 w-11 items-center justify-center"
      >
        <Icon name="chevron-back" size={24} color="#04107E" />
      </Pressable>
      <View className="flex-1">
        {title ? (
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.5}
            className="text-lg font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            maxFontSizeMultiplier={1.4}
            className="text-xs text-gray-500 dark:text-gray-300"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
