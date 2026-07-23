import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

// Placeholder news until Phase 9 wires the real News API. Each item will carry
// its own cover image once news can be uploaded from the dashboard.
type NewsItem = { id: string; title: string; body: string; tint: string; image?: string };
const SAMPLE_NEWS: NewsItem[] = [
  { id: "1", title: "Welcome to ASTRA", body: "Your campus perks, points and events — all in one place.", tint: "#04107E" },
  { id: "2", title: "Earn points on campus", body: "Show your card at partner venues to collect points.", tint: "#3B4AD0" },
  { id: "3", title: "More coming soon", body: "Rewards and exclusive partner offers are on the way.", tint: "#1E2A8A" },
];

// Placeholder events until Phase 8 wires the real Events API. Real events will
// render their uploaded cover picture in place of the tinted icon fallback.
type EventItem = { id: string; title: string; date: string; tint: string; icon: keyof typeof Ionicons.glyphMap; image?: string };
const SAMPLE_EVENTS: EventItem[] = [
  { id: "1", title: "Launch Night", date: "Sep 15", tint: "#04107E", icon: "sparkles" },
  { id: "2", title: "Aperitivo", date: "Sep 22", tint: "#3B4AD0", icon: "wine" },
  { id: "3", title: "Career Day", date: "Oct 3", tint: "#1E2A8A", icon: "briefcase" },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const balance = useQuery({ queryKey: ["points-balance"], queryFn: () => api.points.balance(), retry: false });
  const history = useQuery({ queryKey: ["points-history"], queryFn: () => api.points.history(), retry: false });

  const firstName = me.data?.name?.split(" ")[0];
  const recent = history.data?.entries.slice(0, 3) ?? [];

  const [newsIndex, setNewsIndex] = useState(0);
  function onNewsScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setNewsIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Greeting — welcome + name on one line, softer weight */}
      <Text className="px-5 pt-4 text-2xl font-semibold text-gray-800">
        Welcome
        {firstName ? (
          <>
            , <Text className="text-astra-primary">{firstName}</Text>
          </>
        ) : null}{" "}
        👋
      </Text>

      {/* News feed — full-width, swipe sideways between stories */}
      <View className="mt-4">
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onNewsScroll}
        >
          {SAMPLE_NEWS.map((n) => (
            <View key={n.id} style={{ width }} className="px-5">
              <Pressable
                className="overflow-hidden rounded-2xl active:opacity-90"
                style={{ height: 132 }}
              >
                {n.image ? (
                  <Image source={{ uri: n.image }} resizeMode="cover" style={{ flex: 1 }} />
                ) : (
                  <View
                    style={{ flex: 1, borderWidth: 1.5, borderColor: n.tint }}
                    className="justify-center rounded-2xl bg-white p-5"
                  >
                    <Text className="text-[11px] font-medium uppercase tracking-wide text-astra-primary">
                      News
                    </Text>
                    <Text className="mt-1 text-lg font-semibold text-gray-900">{n.title}</Text>
                    <Text className="mt-1 text-sm text-gray-500" numberOfLines={2}>
                      {n.body}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
        {/* Page dots */}
        <View className="mt-3 flex-row justify-center gap-1.5">
          {SAMPLE_NEWS.map((n, i) => (
            <View
              key={n.id}
              className="h-1.5 rounded-full"
              style={{
                width: i === newsIndex ? 16 : 6,
                backgroundColor: i === newsIndex ? "#04107E" : "#D1D5DB",
              }}
            />
          ))}
        </View>
      </View>

      {/* Latest events — compact cards */}
      <Text className="mt-6 px-5 text-lg font-semibold text-gray-900">Latest events</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}
      >
        {SAMPLE_EVENTS.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => router.push("/events")}
            className="overflow-hidden rounded-2xl"
            style={{ width: 124, height: 140 }}
          >
            {e.image ? (
              <Image source={{ uri: e.image }} resizeMode="cover" style={{ flex: 1 }} />
            ) : (
              <View style={{ flex: 1, backgroundColor: e.tint }} className="justify-between p-3">
                <Ionicons name={e.icon} size={22} color="rgba(255,255,255,0.9)" />
                <View>
                  <Text className="text-sm font-semibold text-white">{e.title}</Text>
                  <Text className="mt-0.5 text-[11px] text-white/70">{e.date}</Text>
                </View>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* Free@B — quick shortcut to the classroom finder */}
      <Pressable
        onPress={() => router.push("/classrooms")}
        className="mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 active:bg-gray-50"
        style={{
          shadowColor: "#04107E",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
          <Ionicons name="school-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">Find a free classroom</Text>
          <Text className="text-xs text-gray-500">Live room availability · Free@B</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      {/* Your account */}
      <Text className="mt-6 px-5 text-lg font-semibold text-gray-900">Your account</Text>
      <View className="px-5 pt-3">
        {/* Points balance */}
        <Pressable
          className="rounded-2xl bg-astra-primary p-5 active:opacity-90"
          onPress={() => router.push("/points-history")}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-wide text-white/70">Your points</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </View>
          <Text className="mt-1 text-4xl font-bold text-white">
            {balance.isLoading ? "…" : (balance.data?.balance ?? 0).toLocaleString()}
          </Text>
          <Text className="mt-1 text-xs text-white/60">Tap to see history</Text>
        </Pressable>

        {/* Recent activity */}
        <View className="mt-3 rounded-2xl border border-gray-100 p-4">
          <Text className="mb-2 text-sm font-medium text-gray-500">Recent activity</Text>
          {recent.length === 0 ? (
            <Text className="py-2 text-center text-gray-400">No activity yet.</Text>
          ) : (
            recent.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between py-2">
                <Text className="flex-1 pr-3 text-gray-800" numberOfLines={1}>
                  {r.reason}
                </Text>
                <Text className={`font-semibold ${r.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {r.delta >= 0 ? "+" : ""}
                  {r.delta}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
