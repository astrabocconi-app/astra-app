import type { ComponentProps } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEggStore } from "../lib/egg-store";

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

export function Icon({ color, ...rest }: ComponentProps<typeof Ionicons>) {
  const mapped = useMappedColor(color);
  return <Ionicons color={mapped as string | undefined} {...rest} />;
}

/**
 * Material Symbols, for the few places where Ionicons' glyph is the wrong
 * shape — its "help" is a bare question mark with no enclosing circle, which
 * sits badly next to the filled person icon in the Home header.
 * Same inverted-mode colour remapping as Icon.
 */
export function MIcon({ color, ...rest }: ComponentProps<typeof MaterialIcons>) {
  const mapped = useMappedColor(color);
  return <MaterialIcons color={mapped as string | undefined} {...rest} />;
}
