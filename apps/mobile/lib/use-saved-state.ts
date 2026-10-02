import { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * useState that survives leaving the screen and restarting the app, for forms
 * a student fills in over several minutes (the grade calculators). Writes are
 * debounced; `ready` is false until the saved value has been read, so a screen
 * doesn't flash its empty state over what the student already typed.
 *
 * ponytail: SecureStore is the only storage in the build. Keep values small
 * (a few KB); move to AsyncStorage if a form ever needs more.
 */
export function useSavedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(key)
      .then((raw) => {
        if (alive && raw) setValue(JSON.parse(raw) as T);
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [key]);

  // The pending write, so leaving the screen mid-debounce still saves it.
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!ready) return;
    const write = () => {
      pending.current = null;
      SecureStore.setItemAsync(key, JSON.stringify(value)).catch(() => {});
    };
    pending.current = write;
    clearTimeout(timer.current);
    timer.current = setTimeout(write, 300);
  }, [key, value, ready]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      pending.current?.();
    },
    [],
  );

  return [value, setValue, ready] as const;
}
