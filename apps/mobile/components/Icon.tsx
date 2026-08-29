import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useEggStore } from "../lib/egg-store";

// Icon colours are props, not classes, so `dark:` can't reach them. This wraps
// Ionicons and remaps the handful of literals the screens actually pass when
// the app is in inverted mode. Anything else is left exactly as given.
const INVERTED: Record<string, string> = {
  "#04107E": "#FFFFFF", // brand blue → white
  "#9CA3AF": "rgba(255,255,255,0.55)", // muted grey → muted white
  "#6B7280": "rgba(255,255,255,0.7)",
};

export function Icon({ color, ...rest }: ComponentProps<typeof Ionicons>) {
  const inverted = useEggStore((s) => s.inverted);
  const mapped = inverted && typeof color === "string" ? (INVERTED[color] ?? color) : color;
  return <Ionicons color={mapped} {...rest} />;
}
