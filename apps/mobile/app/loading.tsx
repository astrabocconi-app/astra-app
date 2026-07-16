import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import LogoLoader from "../components/LogoLoader";
import { api } from "../lib/api";

// Shown right after authentication (and on cold-boot with a saved session),
// bridging to the tabbed home. Plays the logo-morph loader while the profile
// warms, then routes on. Minimum on-screen time so it doesn't just flash.
const MIN_MS = 2200;

export default function LoadingScreen() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const prefetch = queryClient
      .prefetchQuery({ queryKey: ["me"], queryFn: () => api.me() })
      .catch(() => {});
    const minDelay = new Promise((r) => setTimeout(r, MIN_MS));

    Promise.all([prefetch, minDelay]).then(() => {
      if (!cancelled) router.replace("/home");
    });

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
      <LogoLoader size={168} />
    </View>
  );
}
