import { Switch } from "react-native";
import { useSwitchColors } from "../lib/switch-colors";

/** A Switch whose ON track stays visible in inverted mode, with a 44pt hit area and its state exposed. */
export function AppSwitch({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
}) {
  const colors = useSwitchColors();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={colors}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.false}
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{ minHeight: 44, minWidth: 51 }}
    />
  );
}
