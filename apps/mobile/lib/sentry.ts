import Constants from "expo-constants";
import { APP_ENV } from "./config";

// Sentry is DISABLED in development (no noise from local runs) and skipped
// entirely inside Expo Go, whose runtime doesn't include Sentry's native module.
// Real crash reporting kicks in on dev/preview/production builds with a DSN.
type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
};
let sentry: SentryLike | null = null;
let route = "";

export function initSentry() {
  const isExpoGo = Constants.executionEnvironment === "storeClient";
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  // __DEV__ rather than APP_ENV: a release build made without APP_ENV must
  // still report that it is misconfigured (see lib/config.ts).
  if (isExpoGo || __DEV__ || !dsn) return;

  // Loaded lazily so the native module is never required under Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require("@sentry/react-native") as SentryLike;
  Sentry.init({
    dsn,
    enabled: true,
    environment: APP_ENV,
    tracesSampleRate: APP_ENV === "production" ? 0.2 : 1.0,
  });
  sentry = Sentry;
}

/** The screen the student is on; attached to every report so a failure can be placed. */
export function setCurrentRoute(pathname: string) {
  route = pathname;
}

/** Report a handled error. No-op when Sentry is off; never throws. */
export function captureError(error: unknown, extra: Record<string, unknown> = {}) {
  try {
    sentry?.captureException(error, { extra: { route, ...extra } });
  } catch {
    // reporting must never become the next failure
  }
}
