import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon, MIcon } from "../../components/Icon";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";

// Fallback tints for cards without a cover image (cycled by index).
const TINTS = ["#04107E", "#3B4AD0", "#1E2A8A"];

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
          ) : null}{" "}
          👋
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

      {/* Free@B — quick shortcut to the classroom finder */}
      <Pressable
        onPress={() => router.push("/classrooms")}
        className="mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4 active:bg-gray-50"
        style={{
          shadowColor: "#04107E",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
          <Icon name="school-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("home.findClassroom")}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-300">{t("home.findClassroomSub")}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      {/* Materials — handouts & dispense */}
      <Pressable
        onPress={() => router.push("/materials")}
        className="mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4 active:bg-gray-50"
        style={{
          shadowColor: "#04107E",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
          <Icon name="library-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("home.materials")}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-300">{t("home.materialsSub")}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      {/* Rewards — no longer a tab (Discounts took its place), so this is the
          way students reach the catalogue. */}
      <Pressable
        onPress={() => router.push("/rewards")}
        className="mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4 active:bg-gray-50"
        style={{
          shadowColor: "#04107E",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
          <Icon name="gift-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{t("home.rewards")}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-300">{t("home.rewardsSub")}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color="#9CA3AF" />
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
