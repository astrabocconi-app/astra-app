import Constants from "expo-constants";

// Runtime config. In dev we prefer EXPO_PUBLIC_API_URL, which Metro inlines into
// the JS bundle at bundle time — so changing apps/mobile/.env + reloading Metro
// updates the API URL WITHOUT a native rebuild. `extra.apiUrl` (baked into the
// native build via app.config) is the fallback and carries the staging/prod URL
// when EXPO_PUBLIC_API_URL isn't set.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  appEnv?: string;
  mapboxToken?: string;
};

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:3000";
export const APP_ENV = extra.appEnv ?? "development";

// Mapbox PUBLIC access token (pk.*) — safe to ship, it's designed to live in
// client code. Distinct from the secret DOWNLOADS:READ token, which is only
// ever used on the build machine to fetch the native SDK (see app.config.ts).
// Empty when unset: the Discounts map then shows an explanatory state instead
// of a blank rectangle.
export const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? extra.mapboxToken ?? "";
