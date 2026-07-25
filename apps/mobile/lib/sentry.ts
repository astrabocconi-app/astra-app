import Constants from "expo-constants";
import { APP_ENV } from "./config";

// Sentry is DISABLED in development (no noise from local runs) and skipped
// entirely inside Expo Go, whose runtime doesn't include Sentry's native module.
// Real crash reporting kicks in on dev/preview/production builds with a DSN.
export function initSentry() {
  const isExpoGo = Constants.executionEnvironment === "storeClient";
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (isExpoGo || APP_ENV === "development" || !dsn) return;

  // Loaded lazily so the native module is never required under Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require("@sentry/react-native");
  Sentry.init({
    dsn,
    enabled: true,
    environment: APP_ENV,
    tracesSampleRate: APP_ENV === "production" ? 0.2 : 1.0,
  });
}
