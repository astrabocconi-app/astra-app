import { useRef } from "react";

/**
 * Tap counter for hidden gestures. Returns a function to call on each tap; it
 * returns true on every `times`-th tap and false otherwise.
 *
 * Taps must land within `windowMs` of each other or the run restarts — without
 * that, taps months apart would add up and the gesture would fire by accident.
 */
export function useSecretTaps(times: number, windowMs = 1200) {
  const count = useRef(0);
  const last = useRef(0);

  return () => {
    const now = Date.now();
    count.current = now - last.current > windowMs ? 1 : count.current + 1;
    last.current = now;
    if (count.current < times) return false;
    count.current = 0;
    return true;
  };
}
