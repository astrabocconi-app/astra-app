import { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useIsFocused } from "expo-router";
import { Icon, MIcon, Spinner } from "../../components/Icon";
import { NavRow } from "../../components/NavRow";
import { Avatar } from "../../components/Avatar";
import { Text } from "../../components/AppText";
import { api } from "../../lib/api";
import { IMAGES } from "../../lib/assets";
import { useContentWidth } from "../../lib/layout";
import { useLocale, useT } from "../../lib/i18n";
import { usePrefetchScreens } from "../../lib/prefetch";
import { useRefresh } from "../../lib/use-refresh";
import { useLedgerReason } from "../../lib/use-ledger-reason";

/** Smallest the two picture cards get: two side by side in a 20pt-margin row with a 12pt gap, 1.2 : 1. */
const cardMinHeight = (width: number) => Math.round((width - 40 - 12) / 2 / 1.2);

export default function HomeScreen() {
  const t = useT();
  const locale = useLocale();
  const ledgerReason = useLedgerReason();
  const width = useContentWidth();
  const focused = useIsFocused();
  usePrefetchScreens();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const balance = useQuery({
    queryKey: ["points-balance"],
    queryFn: () => api.points.balance(),
    // Catches a partner scan awarded while this screen is open. Only while it is
    // the screen being looked at: a Home sitting under Rewards or on another tab
    // used to keep polling.
    refetchInterval: focused ? 120_000 : false,
  });
  const history = useQuery({ queryKey: ["points-history"], queryFn: () => api.points.history() });
  const news = useQuery({ queryKey: ["news"], queryFn: () => api.news.list() });

  const firstName = me.data?.name?.split(" ")[0];
  const recent = history.data?.entries.slice(0, 3) ?? [];
  const newsItems = news.data?.items ?? [];
  const refresh = useRefresh(balance.refetch, history.refetch, news.refetch);
  // Errors only count when there is nothing older to show: a failed refresh keeps the last numbers.
  const balanceFailed = balance.isError && !balance.data;
  const historyFailed = history.isError && !history.data;
  const newsFailed = news.isError && !news.data;

  const [newsIndex, setNewsIndex] = useState(0);
  function onNewsScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setNewsIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-astra-primary"
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl {...refresh} />}
    >
      {/* Greeting — welcome + name on one line, with the profile button on the
          same baseline rather than up in the header. */}
      <View className="flex-row items-center gap-2 px-5 pt-4">
        <Text accessibilityRole="header" className="flex-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {t("home.welcome")}
          {firstName ? (
            <>
              , <Text className="text-astra-primary dark:text-white">{firstName}</Text>
            </>
          ) : null}
        </Text>
        <Pressable
          onPress={() => router.push("/support")}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t("support.a11yLabel")}
          className="h-11 w-11 items-center justify-center rounded-full bg-astra-light dark:bg-white/10 active:opacity-70"
        >
          {/* Material's filled question mark: it carries its own circle, so it
              matches the weight of the filled person icon beside it. Ionicons'
              "help" is a bare glyph and looked unfinished next to it. */}
          <MIcon name="help" size={22} color="#04107E" />
        </Pressable>
        <Pressable
          onPress={() => router.push("/profile")}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t("tabs.profile")}
          className="h-11 w-11 items-center justify-center active:opacity-70"
        >
          <Avatar seed={me.data?.avatarSeed} size={40} name={me.data?.name} />
        </Pressable>
      </View>

      {/* News feed — full-width, swipe sideways between stories. A placeholder
          holds its space while loading so the cards below don't jump. */}
      {news.isLoading && (
        <View className="mx-5 mt-4 rounded-2xl bg-gray-100 dark:bg-white/10" style={{ aspectRatio: 2 }} />
      )}
      {newsFailed && (
        <View className="mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
          <Icon name="cloud-offline-outline" size={20} color="#6B7280" />
          <Text className="flex-1 text-sm text-gray-600 dark:text-gray-300">{t("home.newsError")}</Text>
          <Pressable
            onPress={() => news.refetch()}
            hitSlop={8}
            accessibilityRole="button"
            className="min-h-[44px] justify-center px-2"
          >
            <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      )}
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
                  accessibilityRole="button"
                  accessibilityLabel={`${t("home.news")}, ${n.title}`}
                  accessibilityHint={newsItems.length > 1 ? t("home.newsPosition", { n: String(i + 1), total: String(newsItems.length) }) : undefined}
                  className="overflow-hidden rounded-2xl active:opacity-90"
                  style={{ aspectRatio: 2 / 1 }}
                >
                  {n.imageUrl ? (
                    <View style={{ flex: 1 }}>
                      <Image
                        source={{ uri: n.imageUrl }}
                        resizeMode="cover"
                        style={StyleSheet.absoluteFill}
                        accessibilityIgnoresInvertColors
                      />
                      {/* light dim; text shadows keep the title/eyebrow readable */}
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.3)" }]} />
                      <View className="flex-1 justify-end p-4">
                        <Text
                          maxFontSizeMultiplier={1.3}
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
                          maxFontSizeMultiplier={1.3}
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
                    <View style={{ flex: 1 }} className="justify-center rounded-2xl bg-astra-light dark:bg-white/10 p-5">
                      <Text maxFontSizeMultiplier={1.3} className="text-[11px] font-medium uppercase tracking-wide text-astra-primary dark:text-white">
                        {t("home.news")}
                      </Text>
                      <Text maxFontSizeMultiplier={1.3} className="mt-1 text-lg font-semibold text-gray-900 dark:text-white" numberOfLines={2}>
                        {n.title}
                      </Text>
                      {n.excerpt ? (
                        <Text maxFontSizeMultiplier={1.3} className="mt-1 text-sm text-gray-600 dark:text-gray-300" numberOfLines={2}>
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
            <View
              className="mt-3 flex-row justify-center gap-1.5"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {newsItems.map((n, i) => (
                <View
                  key={n.id}
                  className={`h-1.5 rounded-full ${i === newsIndex ? "bg-astra-primary dark:bg-white" : "bg-gray-300 dark:bg-white/30"}`}
                  style={{ width: i === newsIndex ? 16 : 6 }}
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

      {/* Two picture cards, then the rewards row. Handouts moved to the
          Academics tab. */}
      {/* The row has a minimum height (the 1.2 : 1 shape at the default text
          size) and grows with the text, so nothing is clipped at larger sizes;
          both cards stretch to the same height. */}
      <View className="mx-5 mt-5 flex-row items-stretch gap-3">
        <Pressable
          onPress={() => router.push("/classrooms")}
          accessibilityRole="button"
          accessibilityLabel={`${t("home.freeAtB")}, ${t("home.freeAtBSub")}`}
          className="flex-1 overflow-hidden rounded-2xl bg-astra-primary active:opacity-90"
          style={{ minHeight: cardMinHeight(width) }}
        >
          {/* Taller than the card and pinned to its bottom, so the middle and
              lower part of the photo (the rows of desks) is what shows. */}
          <Image
            source={IMAGES.freeAtB}
            resizeMode="cover"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: cardMinHeight(width) * 1.7 }}
            accessibilityIgnoresInvertColors
          />
          {/* Brand-blue wash: the photo reads as texture, the text stays legible. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,16,126,0.74)" }]} />
          <View className="flex-1 justify-between gap-3 p-3.5">
            <View className="flex-row items-center gap-1.5">
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#4ADE80" }} />
              <Text maxFontSizeMultiplier={1.3} className="text-[10px] font-semibold uppercase tracking-wider text-white">
                {t("home.freeAtBEyebrow")}
              </Text>
            </View>
            <View>
              <Text maxFontSizeMultiplier={1.3} className="text-lg font-semibold text-white">
                {t("home.freeAtB")}
              </Text>
              <Text maxFontSizeMultiplier={1.3} className="text-xs text-white">
                {t("home.freeAtBSub")}
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push("/polare")}
          accessibilityRole="button"
          accessibilityLabel={`${t("polare.title")}, ${t("home.polareSub")}`}
          className="flex-1 justify-between overflow-hidden rounded-2xl p-3.5 active:opacity-90"
          // Same blue as the logo's own background, so the artwork has no edge.
          style={{ backgroundColor: "#04107E", minHeight: cardMinHeight(width) }}
        >
          <Image
            source={IMAGES.stellaPolare}
            resizeMode="contain"
            style={{ width: "100%", flex: 1, minHeight: 0 }}
            accessibilityIgnoresInvertColors
          />
          <Text maxFontSizeMultiplier={1.3} className="mt-2 text-xs text-white">
            {t("home.polareSub")}
          </Text>
        </Pressable>
      </View>

      {/* Rewards — not a tab (Discounts took its place), so this row is the
          way in. Carries the balance so there's a reason to look at it. */}
      <View className="mx-5 mt-3">
        <NavRow
          icon="card-giftcard"
          title={t("home.rewards")}
          subtitle={t("home.rewardsSub")}
          onPress={() => router.push("/rewards")}
          trailing={
            balance.data ? (
              <Text className="text-sm font-medium text-astra-primary dark:text-white" style={{ fontVariant: ["tabular-nums"] }}>
                {t("home.pointsShort", { n: balance.data.balance.toLocaleString(locale) })}
              </Text>
            ) : null
          }
        />
      </View>

      {/* Your account */}
      <Text accessibilityRole="header" className="mt-6 px-5 text-lg font-semibold text-gray-900 dark:text-white">
        {t("home.yourAccount")}
      </Text>
      <View className="px-5 pt-3">
        {/* Points balance. When it could not be loaded it says so and a tap
            retries, rather than showing 0 points the student does not have. */}
        <Pressable
          className="rounded-2xl bg-astra-primary dark:bg-astra-dark p-5 active:opacity-90"
          accessibilityRole="button"
          onPress={() => (balanceFailed ? balance.refetch() : router.push("/points-history"))}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-white/80">{t("home.yourPoints")}</Text>
            <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
          </View>
          {balanceFailed ? (
            <>
              <Text className="mt-1 text-3xl font-semibold text-white">–</Text>
              <Text accessibilityLiveRegion="polite" className="mt-1 text-xs text-white/80">
                {t("home.pointsUnavailable")}
              </Text>
            </>
          ) : (
            <>
              <Text maxFontSizeMultiplier={1.5} className="mt-1 text-3xl font-semibold text-white">
                {balance.isLoading ? (
                  <Text accessibilityLabel={t("common.loading")}>…</Text>
                ) : (
                  (balance.data?.balance ?? 0).toLocaleString(locale)
                )}
              </Text>
              <Text className="mt-1 text-xs text-white/80">{t("home.tapToSeeHistory")}</Text>
            </>
          )}
        </Pressable>

        {/* Recent activity */}
        <View className="mt-3 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
          <Text accessibilityRole="header" className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            {t("home.recentActivity")}
          </Text>
          {history.isLoading ? (
            <View className="items-center py-3">
              <Spinner />
            </View>
          ) : historyFailed ? (
            <View className="flex-row items-center justify-between gap-3 py-2">
              <Text className="flex-1 text-gray-600 dark:text-gray-300">{t("home.activityError")}</Text>
              <Pressable
                onPress={() => history.refetch()}
                hitSlop={8}
                accessibilityRole="button"
                className="min-h-[44px] justify-center px-2"
              >
                <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">
                  {t("common.retry")}
                </Text>
              </Pressable>
            </View>
          ) : recent.length === 0 ? (
            <Text className="py-2 text-center text-gray-600 dark:text-white/70">{t("home.noActivityYet")}</Text>
          ) : (
            recent.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between py-2">
                <Text className="flex-1 pr-3 text-gray-800 dark:text-gray-100" numberOfLines={2}>
                  {ledgerReason(r.source, r.reason)}
                </Text>
                <Text className={`font-semibold ${r.delta >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
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
