import type { ComponentProps } from "react";
import { ActivityIndicator } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEggStore } from "../lib/egg-store";
import { useT } from "../lib/i18n";

// Icon colours are props, not classes, so `dark:` can't reach them. This wraps
// Ionicons and remaps the handful of literals the screens actually pass when
// the app is in inverted mode. Anything else is left exactly as given.
const INVERTED: Record<string, string> = {
  "#04107E": "#FFFFFF", // brand blue → white
  "#9CA3AF": "rgba(255,255,255,0.55)", // muted grey → muted white
  "#6B7280": "rgba(255,255,255,0.7)",
};

function useMappedColor(color: unknown) {
  const inverted = useEggStore((s) => s.inverted);
  return inverted && typeof color === "string" ? (INVERTED[color] ?? color) : color;
}

// Glyphs are decoration: the control around them carries the name. Left
// visible, a screen reader reads the private-use character as blank or as a symbol.
const DECORATIVE = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

export function Icon({ color, ...rest }: ComponentProps<typeof Ionicons>) {
  const mapped = useMappedColor(color);
  return <Ionicons color={mapped as string | undefined} {...DECORATIVE} {...rest} />;
}

/**
 * Material Symbols, for the few places where Ionicons' glyph is the wrong
 * shape — its "help" is a bare question mark with no enclosing circle, which
 * sits badly next to the filled person icon in the Home header.
 * Same inverted-mode colour remapping as Icon.
 */
export function MIcon({ color, ...rest }: ComponentProps<typeof MaterialIcons>) {
  const mapped = useMappedColor(color);
  return <MaterialIcons color={mapped as string | undefined} {...DECORATIVE} {...rest} />;
}

/**
 * ActivityIndicator in brand blue, white in inverted mode (same remapping).
 * Announces itself as "Loading" and as busy, so a full-screen spinner is not silent.
 */
export function Spinner({ color = "#04107E", ...rest }: ComponentProps<typeof ActivityIndicator>) {
  const mapped = useMappedColor(color);
  const t = useT();
  return (
    <ActivityIndicator
      color={mapped as string}
      accessibilityLabel={t("common.loading")}
      accessibilityState={{ busy: true }}
      {...rest}
    />
  );
}
