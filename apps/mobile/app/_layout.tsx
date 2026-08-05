import "../global.css";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
