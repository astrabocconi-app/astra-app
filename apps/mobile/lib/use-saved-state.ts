import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import * as SecureStore from "expo-secure-store";

export type SavedStateInfo = {
  /**
   * ok: read fine (or nothing saved yet).
   * invalid: something was saved but `validate` rejected it; it is backed up
   *   under `<key>.bak` before the first new write replaces it.
   * unreadable: the keychain failed twice; nothing is written this session, so
   *   a hiccup can never wipe what is stored.
   */
  status: "ok" | "invalid" | "unreadable";
  /** The last write failed (the value is only in memory). */
  saveFailed: boolean;
};

/**
 * useState that survives leaving the screen and restarting the app, for forms
 * a student fills in over several minutes (the grade calculators). Writes are
 * debounced and only happen after the value was actually changed; `ready` is
 * false until the saved value has been read, so a screen doesn't flash its
 * empty state over what the student already typed.
 *
 * `validate` gets whatever JSON was stored and returns the value to use, or
 * null when it can't be used (wrong shape, from an older or newer build).
 *
 * ponytail: SecureStore is the only storage in the build. Keep values small
 * (a few KB); move to AsyncStorage if a form ever needs more.
 */
export function useSavedState<T>(key: string, initial: T, validate?: (raw: unknown) => T | null) {
  const [value, setValueState] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState<SavedStateInfo>({ status: "ok", saveFailed: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Nothing is written until the student changes something (or the stored value
  // had to be cleaned up), and never after a failed read.
  const dirty = useRef(false);
  const blocked = useRef(false);
  const validateRef = useRef(validate);
  validateRef.current = validate;

  useEffect(() => {
    let alive = true;
    const read = async (): Promise<string | null> => {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        await new Promise((r) => setTimeout(r, 250));
        return SecureStore.getItemAsync(key);
      }
    };
    read()
      .then((raw) => {
        if (!alive) return;
        if (!raw) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = undefined;
        }
        const v = parsed === undefined ? null : validateRef.current ? validateRef.current(parsed) : (parsed as T);
        if (v == null) {
          SecureStore.setItemAsync(`${key}.bak`, raw).catch(() => {});
          setInfo((i) => ({ ...i, status: "invalid" }));
          return;
        }
        setValueState(v);
        // Migrated or sanitised on the way in: write the clean copy once.
        if (JSON.stringify(v) !== raw) dirty.current = true;
      })
      .catch(() => {
        blocked.current = true;
        if (alive) setInfo((i) => ({ ...i, status: "unreadable" }));
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [key]);

  const setValue = useCallback((next: SetStateAction<T>) => {
    dirty.current = true;
    setValueState(next);
  }, []);

  // The pending write, so leaving the screen mid-debounce still saves it.
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!ready || !dirty.current || blocked.current) return;
    const write = () => {
      pending.current = null;
      SecureStore.setItemAsync(key, JSON.stringify(value))
        .then(() => setInfo((i) => (i.saveFailed ? { ...i, saveFailed: false } : i)))
        .catch(() => setInfo((i) => ({ ...i, saveFailed: true })));
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

  return [value, setValue, ready, info] as const;
}
