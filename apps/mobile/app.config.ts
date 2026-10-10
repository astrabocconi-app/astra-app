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
  // Custom domain: it serves the very same deployment as the old
  // astra-app-cyan.vercel.app hostname (which must stay alive forever, because
  // builds already installed on phones still point at it). See docs/DEPLOY.md.
  staging: "https://app.astrabocconi.com",
  production: "https://app.astrabocconi.com",
};

const EAS_PROJECT_ID = "69b09e81-0608-41b8-8979-fd3e854ab3d5";

// One string for both the Info.plist key and the expo-camera plugin.
const CAMERA_PURPOSE = "ASTRA uses the camera to scan members' loyalty cards.";

// Sentry source maps + debug files are uploaded at build time, which needs an
// auth token (EAS secret SENTRY_AUTH_TOKEN, plus SENTRY_ORG / SENTRY_PROJECT).
// Without the token the plugin would add an Xcode build phase that FAILS the
// build, so it is only wired in when the token is present: no token = no-op.
const SENTRY_UPLOAD = Boolean(process.env.SENTRY_AUTH_TOKEN);

const config: ExpoConfig = {
  name: APP_ENV === "production" ? "ASTRA" : `ASTRA (${APP_ENV})`,
  slug: "astra-app",
  owner: "mfmatozza",
  scheme: "astra",
  version: "1.1.4",
  orientation: "portrait",
  // Stays "automatic" on purpose: the hidden inverted mode (lib/egg-store.ts)
  // flips the whole app through NativeWind's colorScheme.set(), which drives
  // Appearance, and a hard "light" lock here would stop that from working.
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  backgroundColor: "#FFFFFF",
  // ── OTA updates (expo-updates) ────────────────────────────────────────────
  // Inert until `npx expo install expo-updates` has been run and a native build
  // containing it is shipped; installed builds without the module ignore these
  // fields. Channels are set per build profile in eas.json. The runtime version
  // follows `version`, so bump it whenever native code or native dependencies
  // change, and an OTA bundle can only reach binaries that can run it.
  runtimeVersion: { policy: "appVersion" },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  ios: {
    bundleIdentifier: "it.astrabocconi.app",
    supportsTablet: false,
    infoPlist: {
      // Required for the partner scanner (expo-camera). Kept here so every
      // prebuild includes it regardless of plugin ordering.
      NSCameraUsageDescription: CAMERA_PURPOSE,
      // No microphone string: nothing records audio (the expo-camera plugin is
      // told `microphonePermission: false` below).
      // Required by Apple (ITMS-90683): the bundled Mapbox SDK references the
      // location APIs, so a purpose string must exist even though ASTRA never
      // asks for location: the Discounts map only shows partner pins and the
      // campus, and no permission prompt is ever triggered. The text is kept
      // literally true for that reason.
      NSLocationWhenInUseUsageDescription:
        "ASTRA does not use your location. This notice is required because the map component bundled in the app can read it; the Discounts map only shows partner venues.",
      // The app only makes standard HTTPS calls (no custom/non-exempt encryption),
      // so it qualifies for the export compliance exemption. Without this, every
      // build sits in "Missing Compliance" in App Store Connect and can't be
      // distributed to TestFlight testers until answered manually.
      ITSAppUsesNonExemptEncryption: false,
    },
    // Required-reason APIs used by the app and its pods. React Native, expo-*
    // and the Sentry/Mapbox pods ship their own manifests; these app-level
    // entries mirror the reasons found in the installed packages (see
    // node_modules/*/PrivacyInfo.xcprivacy) so the merged manifest is complete.
    // No tracking, no tracking domains.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],
    },
  },
  android: {
    package: "it.astrabocconi.app",
    // FCM credentials for Android push. Supplied as an EAS file environment
    // variable (GOOGLE_SERVICES_JSON); absent = Android push stays off. The
    // file is never committed.
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
    // Explicit, because with target SDK 36 the window is edge to edge and the
    // keyboard must still resize it (see audit A-25; verify on API 34-36).
    softwareKeyboardLayoutMode: "resize",
  },
  plugins: [
    "expo-router",
    // Source maps + debug files for Sentry (token-gated, see SENTRY_UPLOAD).
    // Org/project come from SENTRY_ORG / SENTRY_PROJECT in the build env.
    ...(SENTRY_UPLOAD ? ["@sentry/react-native/expo"] : []),
    "expo-secure-store",
    "expo-notifications",
    "expo-web-browser",
    "expo-video",
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
        cameraPermission: CAMERA_PURPOSE,
        microphonePermission: false,
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
      // Listed BEFORE expo-alternate-app-icons on purpose. Expo composes
      // dangerous mods so the last one added runs FIRST, so being earlier in
      // this array means running last — after the icon has been generated.
      //
      // That plugin re-encodes the icon with jimp, which writes RGBA even when
      // the source PNG is opaque, so the alternate icon reaches Images.xcassets
      // with an alpha channel and Apple rejects app icons that have one. This
      // puts the opaque original back. See plugins/with-opaque-alternate-icon.js.
      "./plugins/with-opaque-alternate-icon",
      { name: "Inverted", source: "./assets/icon-inverted.png" },
    ],
    [
      // Alternate launcher icon for the hidden inverted mode (lib/egg-store.ts).
      // The icon set is copied into the native projects at prebuild, so the
      // swap only works in a build made after this plugin was added.
      "expo-alternate-app-icons",
      [
        {
          name: "Inverted",
          ios: "./assets/icon-inverted.png",
          // The same square feeds the Android adaptive foreground.
          // If it ends up cropped in the launcher mask, cut a padded
          // foreground-only variant rather than adding tooling for it.
          android: {
            foregroundImage: "./assets/icon-inverted.png",
            backgroundColor: "#04107E",
          },
        },
      ],
    ],
    [
      // Android must target API 36 (required on Play as of 2026-08-31); SDK 57
      // supports it.
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
      projectId: EAS_PROJECT_ID,
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
