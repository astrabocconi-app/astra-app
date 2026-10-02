import type { ComponentProps, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { MIcon, Icon } from "./Icon";

// The standalone tappable row: icon tile, title + subtitle, chevron. Home's
// rewards row, the Academics resources and the Profile rows all use it so they
// stay identical. `eyebrow` is a small label above the title (Profile's
// "Programme", "Year"…); `disabled` dims the row and ignores taps.
export function NavRow({
  icon,
  title,
  subtitle,
  eyebrow,
  trailing,
  disabled,
  onPress,
}: {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  subtitle?: string;
  eyebrow?: string;
  trailing?: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={`flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4 active:bg-gray-50 dark:active:bg-white/5 ${
        disabled ? "opacity-40" : ""
      }`}
      style={{
        shadowColor: "#04107E",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
        <MIcon name={icon} size={22} color="#04107E" />
      </View>
      <View className="flex-1">
        {eyebrow ? <Text className="text-xs text-gray-500 dark:text-gray-300">{eyebrow}</Text> : null}
        <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-gray-500 dark:text-gray-300" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      <Icon name="chevron-forward" size={18} color="#9CA3AF" />
    </Pressable>
  );
}
