import "../global.css";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus, View, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { initSentry } from "../lib/sentry";
import { loadToken, loadAccountType } from "../lib/session";
import { registerForPush } from "../lib/push";
import { useBootStore } from "../lib/boot-store";
import { useLanguageStore } from "../lib/language-store";
import BootOverlay from "../components/BootOverlay";

initSentry();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const booting = useBootStore((s) => s.booting);

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

  useEffect(() => {
    // Restore the persisted session before showing any screen; if we already
    // have a token, route by account type — partners to their venue home,
    // students through the intro overlay to the tabbed home.
    Promise.all([
      loadToken(),
      loadAccountType(),
      useLanguageStore.getState().hydrate(),
    ]).then(([token, type]) => {
      if (token) {
        if (type === "partner") {
          router.replace("/partner/home");
        } else {
          useBootStore.getState().trigger();
          router.replace("/home");
          void registerForPush();
        }
      }
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
        {booting && <BootOverlay />}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
