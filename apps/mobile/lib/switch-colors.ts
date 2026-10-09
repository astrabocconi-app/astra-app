import { useEggStore } from "./egg-store";

/**
 * Track colours for a Switch. The ON track must not be the page colour: in
 * inverted mode the page is #04107E, which made an ON switch a white thumb on
 * nothing.
 */
export function useSwitchColors() {
  const inverted = useEggStore((s) => s.inverted);
  return inverted
    ? { false: "rgba(255,255,255,0.25)", true: "#8B9BFF" }
    : { false: "#D1D5DB", true: "#04107E" };
}
