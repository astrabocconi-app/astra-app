import { Switch } from "react-native";
import { useSwitchColors } from "../lib/switch-colors";

/** A Switch whose ON track stays visible in inverted mode, with its state exposed. */
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
      trackColor={{ true: colors.true }}
      thumbColor="#FFFFFF"
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    />
  );
}
