import * as Sentry from "@sentry/react-native";
import { APP_ENV } from "./config";

// Sentry is DISABLED in development (no noise from local runs).
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  Sentry.init({
    dsn,
    enabled: APP_ENV !== "development" && Boolean(dsn),
    environment: APP_ENV,
    tracesSampleRate: APP_ENV === "production" ? 0.2 : 1.0,
  });
}
