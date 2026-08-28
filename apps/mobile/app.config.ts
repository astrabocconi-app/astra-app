import type { ExpoConfig } from "expo/config";

// Per-environment API base URL. Points at the deployed apps/web instance.
// APP_ENV is injected by the EAS build profile (see eas.json) or the shell.
const APP_ENV = (process.env.APP_ENV ?? "development") as
  | "development"
  | "staging"
  | "production";

const API_URL: Record<typeof APP_ENV, string> = {
  // Dev uses localhost (so the dev-login bypass works against the local API).
  development: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  staging: "https://astra-app-cyan.vercel.app",
  production: "https://astra-app-cyan.vercel.app",
};

const config: ExpoConfig = {
  name: APP_ENV === "production" ? "ASTRA" : `ASTRA (${APP_ENV})`,
  slug: "astra-app",
  owner: "mfmatozza",
  scheme: "astra",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  backgroundColor: "#FFFFFF",
  ios: {
    bundleIdentifier: "it.astrabocconi.app",
    supportsTablet: false,
    infoPlist: {
      // Required for the partner scanner (expo-camera). Kept here so every
      // prebuild includes it regardless of plugin ordering.
      NSCameraUsageDescription: "ASTRA uses the camera to scan member loyalty cards.",
      NSMicrophoneUsageDescription:
        "ASTRA uses the microphone only as part of the camera scanner.",
      // The app only makes standard HTTPS calls (no custom/non-exempt encryption),
      // so it qualifies for the export compliance exemption. Without this, every
      // build sits in "Missing Compliance" in App Store Connect and can't be
      // distributed to TestFlight testers until answered manually.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "it.astrabocconi.app",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
      },
    ],
    [
      // Partner venues use the camera to scan members' loyalty-card QR codes.
      "expo-camera",
      {
        cameraPermission: "ASTRA uses the camera to scan members' loyalty cards.",
        recordAudioAndroid: false,
      },
    ],
    // Native Mapbox SDK for the Discounts map. The iOS/Android SDKs live in
    // Mapbox's private registry, so the BUILD machine needs a secret token with
    // the DOWNLOADS:READ scope. It is supplied ONLY through the
    // RNMAPBOX_MAPS_DOWNLOAD_TOKEN environment variable, never as a plugin
    // option: plugin options are serialised into the app config that ships
    // inside the IPA, which would leak the secret to anyone who unzips the app.
    // The public pk.* token used at runtime is separate — see lib/config.ts.
    "@rnmapbox/maps",
    [
      // Android must target API 36 (required on Play as of 2026-08-31).
      // TODO(scaffold): verify the pinned Expo SDK 57 fully supports API 36.
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          minSdkVersion: 24,
        },
      },
    ],
  ],
  extra: {
    apiUrl: API_URL[APP_ENV],
    appEnv: APP_ENV,
    // Public Mapbox token (pk.*), baked in per build so standalone/TestFlight
    // builds render the map without relying on a local .env.
    mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "",
    eas: {
      projectId: "69b09e81-0608-41b8-8979-fd3e854ab3d5",
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
