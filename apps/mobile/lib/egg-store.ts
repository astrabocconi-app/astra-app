import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";
import { setAlternateAppIcon, supportsAlternateIcons } from "expo-alternate-app-icons";

// Hidden "inverted" mode. Eight taps on the ASTRA wordmark in the home header
// flip the app from blue-on-white to white-on-blue: dark UI, white wordmark,
// and the white-on-blue launcher icon. Eight more taps put it back.
//
// Persisted, so the flip survives a restart — otherwise finding the egg once
// and losing it on the next launch reads as a bug.

const INVERTED_KEY = "astra_inverted";

/** Must match the alternate icon declared in app.config.ts. */
const ALTERNATE_ICON = "Inverted";

function applyIcon(inverted: boolean) {
  // ponytail: silent failure is the right call here. The native build only
  // knows about the alternate icon after a prebuild, so in Expo Go or an older
  // dev client this throws — and an easter egg must never take the app down.
  if (!supportsAlternateIcons) return;
  setAlternateAppIcon(inverted ? ALTERNATE_ICON : null).catch(() => {});
}

function apply(inverted: boolean) {
  colorScheme.set(inverted ? "dark" : "light");
  applyIcon(inverted);
}

type EggState = {
  inverted: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleInverted: () => void;
};

export const useEggStore = create<EggState>((set, get) => ({
  inverted: false,
  hydrated: false,
  hydrate: async () => {
    const inverted = (await SecureStore.getItemAsync(INVERTED_KEY)) === "1";
    apply(inverted);
    set({ inverted, hydrated: true });
  },
  toggleInverted: () => {
    const inverted = !get().inverted;
    set({ inverted });
    apply(inverted);
    void SecureStore.setItemAsync(INVERTED_KEY, inverted ? "1" : "0").catch(() => {});
  },
}));
