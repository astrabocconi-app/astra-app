import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon, MIcon } from "../../components/Icon";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";

// Fallback tints for cards without a cover image (cycled by index).
const TINTS = ["#04107E", "#3B4AD0", "#1E2A8A"];
const GOLD = "#FFCC00";
// Polare is the press: set it like a masthead.
const SERIF = Platform.select({ ios: "Georgia", default: "serif" });

// A floor of rooms, some free — decorative, not live data.
const ROOMS = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1];
function RoomGrid() {
  return (
    <View style={{ width: 4 * 7 + 3 * 3, flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
      {ROOMS.map((free, i) => (
        <View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 1.5,
            backgroundColor: free ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)",
          }}
        />
      ))}
    </View>
  );
}

/** Four-point star — the pole star the press is named after. */
function PoleStar() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" fill="#04107E" />
    </Svg>
  );
}

export default function HomeScreen() {
  const t = useT();
  const { width } = useWindowDimensions();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const balance = useQuery({
    queryKey: ["points-balance"],
    queryFn: () => api.points.balance(),
    retry: false,
    refetchInterval: 30_000, // catch a partner scan awarded while this screen is open
  });
  const history = useQuery({ queryKey: ["points-history"], queryFn: () => api.points.history(), retry: false });
  const news = useQuery({ queryKey: ["news"], queryFn: () => api.news.list(), retry: false });

  const firstName = me.data?.name?.split(" ")[0];
  const recent = history.data?.entries.slice(0, 3) ?? [];
  const newsItems = news.data?.items ?? [];

  const [newsIndex, setNewsIndex] = useState(0);
  function onNewsScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setNewsIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-astra-primary" contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Greeting — welcome + name on one line, with the profile button on the
          same baseline rather than up in the header. */}
      <View className="flex-row items-center gap-3 px-5 pt-4">
        <Text className="flex-1 text-2xl font-semibold text-gray-800 dark:text-gray-100">
          {t("home.welcome")}
          {firstName ? (
            <>
              , <Text className="text-astra-primary dark:text-white">{firstName}</Text>
            </>
          ) : null}
        </Text>
        <Pressable
          onPress={() => router.push("/support")}
          hitSlop={10}
          accessibilityLabel={t("support.a11yLabel")}
          className="h-10 w-10 items-center justify-center rounded-full bg-astra-light dark:bg-white/10 active:opacity-70"
        >
          {/* Material's filled question mark: it carries its own circle, so it
              matches the weight of the filled person icon beside it. Ionicons'
              "help" is a bare glyph and looked unfinished next to it. */}
          <MIcon name="help" size={22} color="#04107E" />
        </Pressable>
        <Pressable
          onPress={() => router.push("/profile")}
          hitSlop={10}
          accessibilityLabel={t("tabs.profile")}
          className="h-10 w-10 items-center justify-center rounded-full bg-astra-light dark:bg-white/10 active:opacity-70"
        >
          <Icon name="person" size={20} color="#04107E" />
        </Pressable>
      </View>

      {/* News feed — full-width, swipe sideways between stories */}
      {newsItems.length > 0 && (
        <View className="mt-4">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onNewsScroll}
          >
            {newsItems.map((n, i) => (
              <View key={n.id} style={{ width }} className="px-5">
                <Pressable
                  onPress={() => router.push(`/news/${n.id}`)}
                  className="overflow-hidden rounded-2xl active:opacity-90"
                  style={{ aspectRatio: 2 / 1 }}
                >
                  {n.imageUrl ? (
                    <View style={{ flex: 1 }}>
                      <Image source={{ uri: n.imageUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} />
                      {/* light dim; text shadows keep the title/eyebrow readable */}
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.22)" }]} />
                      <View className="flex-1 justify-end p-4">
                        <Text
                          className="text-xs font-bold uppercase tracking-wider text-white"
                          style={{
                            textShadowColor: "rgba(0,0,0,0.75)",
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 4,
                          }}
                        >
                          {t("home.news")}
                        </Text>
                        <Text
                          className="mt-1 text-xl font-bold text-white"
                          numberOfLines={2}
                          style={{
                            textShadowColor: "rgba(0,0,0,0.75)",
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 5,
                          }}
                        >
                          {n.title}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={{ flex: 1, borderWidth: 1.5, borderColor: TINTS[i % TINTS.length] }}
                      className="justify-center rounded-2xl bg-white dark:bg-astra-primary p-5"
                    >
                      <Text className="text-[11px] font-medium uppercase tracking-wide text-astra-primary dark:text-white">
                        {t("home.news")}
                      </Text>
                      <Text className="mt-1 text-lg font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
                        {n.title}
                      </Text>
                      {n.excerpt ? (
                        <Text className="mt-1 text-sm text-gray-500 dark:text-gray-300" numberOfLines={2}>
                          {n.excerpt}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {newsItems.length > 1 && (
            <View className="mt-3 flex-row justify-center gap-1.5">
              {newsItems.map((n, i) => (
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
          )}
        </View>
      )}

      {/* Ask ASTRA (the RAG assistant) is deliberately absent from v1 — the
          answer quality still needs work, and shipping it half-good would set
          the wrong expectation on day one. The screen, the API route and the
          retrieval pipeline are all still in the repo; restore this entry point
          to bring it back. */}

      {/* Two squares, then one bar. Handouts and the gradebook moved to the
          Academics tab. */}
      <View className="mx-5 mt-5 flex-row gap-3">
        <Pressable
          onPress={() => router.push("/classrooms")}
          accessibilityLabel={`${t("home.freeAtB")}, ${t("home.freeAtBSub")}`}
          className="flex-1 justify-between rounded-[18px] bg-astra-primary dark:bg-white/10 p-4 active:opacity-90"
          style={{ aspectRatio: 1 }}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-center gap-1.5">
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#4ADE80" }} />
              <Text className="text-[11px] font-bold uppercase text-white/70" style={{ letterSpacing: 1.2 }}>
                {t("home.freeAtBEyebrow")}
              </Text>
            </View>
            <RoomGrid />
          </View>
          <View>
            <Text className="text-[27px] font-extrabold text-white" style={{ letterSpacing: -0.6 }}>
              {t("home.freeAtB")}
            </Text>
            <Text className="mt-0.5 text-[13px] leading-[17px] text-white/75">{t("home.freeAtBSub")}</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push("/polare")}
          accessibilityLabel={`ASTRA ${t("home.polare")}, ${t("home.polareSub")}`}
          className="flex-1 justify-between rounded-[18px] p-4 active:opacity-90"
          style={{ aspectRatio: 1, backgroundColor: GOLD }}
        >
          <View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase text-astra-primary" style={{ letterSpacing: 1.2 }}>
                {t("home.polareEyebrow")}
              </Text>
              <PoleStar />
            </View>
            <View className="mt-2" style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: "#04107E" }} />
          </View>
          <View>
            <Text className="text-astra-primary" style={{ fontFamily: SERIF, fontSize: 30, fontWeight: "700", letterSpacing: -0.4 }}>
              {t("home.polare")}
            </Text>
            <Text className="mt-0.5 text-[13px] leading-[17px] text-astra-primary/75">{t("home.polareSub")}</Text>
          </View>
        </Pressable>
      </View>

      {/* Rewards — not a tab (Discounts took its place), so this bar is the
          way in. Carries the balance so there's a reason to look at it. */}
      <Pressable
        onPress={() => router.push("/rewards")}
        className="mx-5 mt-3 flex-row items-center rounded-[18px] border-[1.5px] border-astra-primary dark:border-white/30 px-4 py-4 active:bg-astra-light dark:active:bg-white/10"
      >
        <View className="flex-1">
          <Text className="text-lg font-bold text-astra-primary dark:text-white" style={{ letterSpacing: -0.3 }}>
            {t("home.rewards")}
          </Text>
          <Text className="text-[13px] text-gray-500 dark:text-gray-300">{t("home.rewardsSub")}</Text>
        </View>
        {balance.data ? (
          <View className="mr-2 rounded-full bg-astra-light dark:bg-white/15 px-3 py-1">
            <Text className="text-[13px] font-bold text-astra-primary dark:text-white" style={{ fontVariant: ["tabular-nums"] }}>
              {t("home.pointsShort", { n: balance.data.balance.toLocaleString() })}
            </Text>
          </View>
        ) : null}
        <Icon name="arrow-forward" size={18} color="#04107E" />
      </Pressable>

      {/* Your account */}
      <Text className="mt-6 px-5 text-lg font-semibold text-gray-900 dark:text-white">{t("home.yourAccount")}</Text>
      <View className="px-5 pt-3">
        {/* Points balance */}
        <Pressable
          className="rounded-2xl bg-astra-primary dark:bg-astra-dark p-5 active:opacity-90"
          onPress={() => router.push("/points-history")}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-wide text-white/70">{t("home.yourPoints")}</Text>
            <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </View>
          <Text className="mt-1 text-4xl font-bold text-white">
            {balance.isLoading ? "…" : (balance.data?.balance ?? 0).toLocaleString()}
          </Text>
          <Text className="mt-1 text-xs text-white/60">{t("home.tapToSeeHistory")}</Text>
        </Pressable>

        {/* Recent activity */}
        <View className="mt-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-300">{t("home.recentActivity")}</Text>
          {recent.length === 0 ? (
            <Text className="py-2 text-center text-gray-400 dark:text-white/60">{t("home.noActivityYet")}</Text>
          ) : (
            recent.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between py-2">
                <Text className="flex-1 pr-3 text-gray-800 dark:text-gray-100" numberOfLines={1}>
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
