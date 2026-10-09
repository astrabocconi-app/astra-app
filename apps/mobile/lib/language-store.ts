import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { pickLanguage, type Language } from "./locale";

// Client-side persistence of the user's chosen UI language (device keychain,
// same pattern as profile-store.ts). Unlike course/year, this must be
// hydrated eagerly in the root layout — before the login screen ever
// renders — since it needs to affect pre-auth screens too.

export type { Language };

const LANGUAGE_KEY = "astra_language_v2";

/** The phone's language, e.g. "it-IT". Hermes ships Intl; undefined if the engine lacks it. */
function deviceLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

type LanguageState = {
  language: Language;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: pickLanguage(null, deviceLocale()),
  hydrated: false,
  hydrate: async () => {
    // A keychain hiccup must not stop the app booting: fall back to the phone's language.
    const stored = await SecureStore.getItemAsync(LANGUAGE_KEY).catch(() => null);
    set({ language: pickLanguage(stored, deviceLocale()), hydrated: true });
  },
  setLanguage: async (language) => {
    // State first: the switch must work even if the keychain refuses the write.
    set({ language });
    try {
      await SecureStore.setItemAsync(LANGUAGE_KEY, language);
    } catch {
      // the choice lasts until the app closes
    }
  },
}));
