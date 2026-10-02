import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

// Client-side persistence of the user's chosen UI language (device keychain,
// same pattern as profile-store.ts). Unlike course/year, this must be
// hydrated eagerly in the root layout — before the login screen ever
// renders — since it needs to affect pre-auth screens too.

export type Language = "en" | "it";

// v2 since 1.1.1: the iOS keychain outlives reinstalls, so phones that once
// picked Italian stayed Italian even for a fresh install or a new account. The
// new key starts everyone on English again; Profile switches it back.
const LANGUAGE_KEY = "astra_language_v2";
const DEFAULT_LANGUAGE: Language = "en";

type LanguageState = {
  language: Language;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  hydrated: false,
  hydrate: async () => {
    const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
    set({ language: stored === "it" ? "it" : DEFAULT_LANGUAGE, hydrated: true });
  },
  setLanguage: async (language) => {
    await SecureStore.setItemAsync(LANGUAGE_KEY, language);
    set({ language });
  },
}));
