import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Icon } from "./Icon";
import { Text } from "./AppText";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// The one look for empty, error and not-found states. Errors use
// "cloud-offline-outline" and a retry action; never show the raw error text.
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IoniconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
        <Icon name={icon} size={30} color="#04107E" />
      </View>
      <Text
        accessibilityRole="header"
        className="text-center text-base font-semibold text-gray-900 dark:text-white"
      >
        {title}
      </Text>
      {body ? <Text className="text-center text-gray-500 dark:text-gray-300">{body}</Text> : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          className="mt-1 min-h-[44px] justify-center rounded-xl bg-astra-primary dark:bg-white/15 px-5 py-2.5 active:opacity-80"
        >
          <Text chrome className="text-sm font-semibold text-white">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
