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
  staging: "https://astra-app-liard.vercel.app",
  production: "https://astra-app-liard.vercel.app",
};

const config: ExpoConfig = {
  name: APP_ENV === "production" ? "ASTRA" : `ASTRA (${APP_ENV})`,
  slug: "astra-app",
  scheme: "astra",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  backgroundColor: "#FFFFFF",
  // Splash screen is configured at build time (expo-splash-screen) — not shown
  // in Expo Go. TODO(build): add the plugin with the brand splash asset.
  ios: {
    bundleIdentifier: "it.astrabocconi.app",
    supportsTablet: false,
  },
  android: {
    package: "it.astrabocconi.app",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      // Partner venues use the camera to scan members' loyalty-card QR codes.
      "expo-camera",
      {
        cameraPermission: "ASTRA uses the camera to scan members' loyalty cards.",
        recordAudioAndroid: false,
      },
    ],
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
    eas: {
      // TODO(scaffold): set your EAS projectId (from `eas init`).
      projectId: "REPLACE_WITH_EAS_PROJECT_ID",
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
