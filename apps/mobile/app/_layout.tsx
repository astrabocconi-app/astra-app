import "../global.css";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus, Pressable, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { queryClient } from "../lib/query-client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CONFIG_ERROR } from "../lib/config";
import { captureError, initSentry, setCurrentRoute } from "../lib/sentry";
import {
  loadToken,
  loadAccountType,
  loadPartnerScanOnly,
  loadUserId,
  type AccountType,
} from "../lib/session";
import { attachNotificationRouting } from "../lib/push";
import { openRoute } from "../lib/open-route";
import { useAuthStore } from "../lib/auth-store";
import { useBootStore } from "../lib/boot-store";
import { useLanguageStore } from "../lib/language-store";
import { useEggStore } from "../lib/egg-store";
import { clearLegacyAcademicProfile } from "../lib/profile-store";
import { MAX_CONTENT_WIDTH } from "../lib/layout";
import { useT } from "../lib/i18n";
import BootOverlay from "../components/BootOverlay";
import { Spinner } from "../components/Icon";
import { Text } from "../components/AppText";

initSentry();
// A release build pointed at a developer machine can never work; say so once.
if (CONFIG_ERROR) captureError(new Error(CONFIG_ERROR), { what: "config" });

// A login screen sits at the root, so a deep link into any other screen has
// somewhere to go Back to instead of an empty stack.
export const unstable_settings = { anchor: "index" };

/**
 * Catches a render error in any screen. Without it a release build simply
 * closes on the student; with it they see this, can reload the screen, and the
 * error reaches Sentry.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const t = useT();
  useEffect(() => {
    captureError(error, { what: "render" });
  }, [error]);
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white dark:bg-astra-primary px-8">
      <Text accessibilityRole="header" className="text-center text-xl font-semibold text-gray-900 dark:text-white">
        {t("common.crashTitle")}
      </Text>
      <Text className="text-center text-gray-600 dark:text-gray-300">{t("common.crashBody")}</Text>
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        className="min-h-[48px] justify-center rounded-xl bg-astra-primary dark:bg-white/15 px-8 py-3 active:opacity-90"
      >
        <Text chrome className="text-base font-semibold text-white">
          {t("common.reload")}
        </Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const ready = useAuthStore((s) => s.ready);
  const signedIn = useAuthStore((s) => s.signedIn);
  const accountType = useAuthStore((s) => s.accountType);
  const session = useAuthStore((s) => s.session);
  const booting = useBootStore((s) => s.booting);
  const inverted = useEggStore((s) => s.inverted);
  const pathname = usePathname();
  const t = useT();

  useEffect(() => {
    // React Query's refetch-on-focus needs to be told about app foreground/
    // background manually on native (there's no browser "window focus" event).
    // Without this, a screen kept mounted across a tab switch never refetches
    // its stale queries on its own — e.g. the home tab's points balance only
    // ever updates on a fresh mount, not when a partner scan awards points
    // elsewhere and the student later re-opens the app.
    function onAppStateChange(status: AppStateStatus) {
      focusManager.setFocused(status === "active");
    }
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, []);

  useEffect(() => setCurrentRoute(pathname), [pathname]);

  useEffect(() => {
    if (CONFIG_ERROR) {
      useAuthStore.getState().restore(false, null);
      return;
    }
    // Restore the persisted session before showing any screen. Each read is
    // independent: one keychain failure (a locked phone after a reboot, a
    // restored backup) must not leave the app on a spinner for ever, so the
    // worst case is the login screen.
    void (async () => {
      let token: string | null = null;
      let type: AccountType | null = null;
      try {
        const results = await Promise.allSettled([
          loadToken(),
          loadAccountType(),
          loadPartnerScanOnly(),
          loadUserId(),
          useLanguageStore.getState().hydrate(),
          // Before the first screen paints, or the app flashes light then flips.
          useEggStore.getState().hydrate(),
        ]);
        if (results[0].status === "fulfilled") token = results[0].value;
        if (results[1].status === "fulfilled") type = results[1].value;
        // Old builds kept an unauthenticated course selection on the phone; it
        // is never read any more, and must not outlive a sign-out.
        void clearLegacyAcademicProfile().catch(() => {});
      } finally {
        // Students are the default account type for sessions saved before the type was stored.
        useAuthStore.getState().restore(Boolean(token), token ? (type ?? "student") : null);
      }
    })();
  }, []);

  // Tapping a notification with a `route` opens that screen. Attached once the
  // signed-in session has left the login screen, so a cold-start tap lands on
  // the right screen rather than being replaced by the redirect to Home, and
  // never while signed out (the screen it names would have nothing to load).
  const [routingReady, setRoutingReady] = useState(false);
  useEffect(() => {
    if (!signedIn) setRoutingReady(false);
    else if (pathname !== "/") setRoutingReady(true);
  }, [signedIn, pathname]);
  useEffect(() => {
    if (!routingReady) return;
    let detach: (() => void) | undefined;
    let cancelled = false;
    void attachNotificationRouting(openRoute).then((off) => {
      if (cancelled) off();
      else detach = off;
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [routingReady, session]);

  if (CONFIG_ERROR) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-astra-primary px-8">
        <Text className="text-center text-base text-gray-700 dark:text-gray-200">{t("common.misconfigured")}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-astra-primary">
        <Spinner />
      </View>
    );
  }

  const isStudent = signedIn && accountType === "student";
  const isPartner = signedIn && accountType === "partner";

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={inverted ? "light" : "dark"} />
        {/* On a tablet or an unfolded foldable the app keeps a phone-sized column. */}
        <View style={{ flex: 1, backgroundColor: inverted ? "#04107E" : "#FFFFFF" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
            {/* Screens are declared per account type behind a guard, so a signed-out
                deep link lands on the login, and signing out removes every protected
                screen from the stack at once. The login cannot be swiped away. */}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ gestureEnabled: false }} />
              <Stack.Protected guard={isStudent}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="rewards" />
                <Stack.Screen name="materials" />
                <Stack.Screen name="classrooms" />
                <Stack.Screen name="support" />
                <Stack.Screen name="points-history" />
                <Stack.Screen name="polare" />
                <Stack.Screen name="guides" />
                <Stack.Screen name="calculator" />
                <Stack.Screen name="master-admissions" />
                <Stack.Screen name="event/[id]" />
                <Stack.Screen name="venue/[id]" />
                <Stack.Screen name="news/[id]" />
              </Stack.Protected>
              <Stack.Protected guard={isPartner}>
                <Stack.Screen name="partner" />
              </Stack.Protected>
            </Stack>
          </View>
        </View>
        {booting && <BootOverlay />}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
