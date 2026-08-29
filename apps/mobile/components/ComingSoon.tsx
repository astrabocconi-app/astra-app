import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Icon } from "./Icon";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function ComingSoon({
  icon,
  title,
  description,
}: {
  icon: IoniconName;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white dark:bg-astra-primary px-8">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
        <Icon name={icon} size={30} color="#04107E" />
      </View>
      <Text className="text-xl font-semibold text-astra-primary dark:text-white">{title}</Text>
      <Text className="text-center text-gray-500 dark:text-gray-300">{description}</Text>
      <Text className="mt-1 text-xs uppercase tracking-wide text-gray-400 dark:text-white/60">Coming soon</Text>
    </View>
  );
}
