import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Spinner } from "./Icon";
import { Text } from "./AppText";

/**
 * The full-width brand button. While `loading` it keeps its label (with the
 * spinner beside it) so a screen reader still hears what it is, and reports
 * itself as busy; disabled and busy buttons ignore taps.
 */
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  className = "",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`min-h-[48px] w-full flex-row items-center justify-center gap-2 rounded-xl bg-astra-primary dark:bg-white/15 px-4 py-3 ${
        disabled && !loading ? "opacity-40" : loading ? "opacity-80" : "active:opacity-90"
      } ${className}`}
    >
      {loading ? <Spinner color="#fff" /> : icon ? <View>{icon}</View> : null}
      <Text chrome className="text-center text-base font-semibold text-white" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
