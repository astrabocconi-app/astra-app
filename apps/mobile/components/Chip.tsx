import { Pressable } from "react-native";
import { Text } from "./AppText";

/**
 * A pill in a single-choice group (filters, scope switches). One component so
 * every group exposes the same thing to a screen reader: a radio with a
 * selected state, not a colour change nobody can hear.
 */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, checked: active }}
      className={`min-h-[36px] justify-center rounded-full px-3.5 py-2 ${
        active ? "bg-astra-primary dark:bg-white" : "bg-gray-100 dark:bg-white/10"
      }`}
    >
      <Text
        chrome
        className={`text-[13px] font-medium ${
          active ? "text-white dark:text-astra-primary" : "text-gray-700 dark:text-gray-200"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
