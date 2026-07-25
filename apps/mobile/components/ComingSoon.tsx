import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
    <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light">
        <Ionicons name={icon} size={30} color="#04107E" />
      </View>
      <Text className="text-xl font-semibold text-astra-primary">{title}</Text>
      <Text className="text-center text-gray-500">{description}</Text>
      <Text className="mt-1 text-xs uppercase tracking-wide text-gray-400">Coming soon</Text>
    </View>
  );
}
