import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the person asked the OS to reduce motion. Starts false and settles
 * after one async read, then follows changes made while the app is open.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Say something to screen-reader users (a saved name, a scan result, an error). No-op otherwise. */
export function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}
