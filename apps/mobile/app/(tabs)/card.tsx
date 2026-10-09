import { useEffect, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Icon, Spinner } from "../../components/Icon";
import { Text } from "../../components/AppText";
import { api } from "../../lib/api";
import { IMAGES } from "../../lib/assets";
import { useContentWidth } from "../../lib/layout";
import { saveCardToken, loadCardToken, getUserId, setUserId } from "../../lib/session";
import { pickCardToken, type CardCache } from "../../lib/card-cache";
import { useT } from "../../lib/i18n";

// The student's loyalty card: a QR encoding a signed token. Partner venues scan
// it to award points. The server honours a token for 15 minutes, so the card
// refreshes itself, and a token older than 10 minutes is never shown as if it
// still worked: the QR gives way to "Reconnect to refresh".
export default function CardScreen() {
  const t = useT();
  const focused = useIsFocused();
  const width = useContentWidth();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const card = useQuery({
    queryKey: ["card-token"],
    queryFn: () => api.card.token(),
    // Just inside the 10-minute freshness window, and only while this tab is the
    // one being looked at. Coming back from the background refetches once the
    // token is more than 5 minutes old.
    staleTime: 5 * 60_000,
    refetchInterval: focused ? 9 * 60_000 : false,
  });

  // Who the cached token belongs to: the account just loaded, or the one the
  // session remembered (so a cold start offline can still tell).
  const uid = me.data?.id ?? getUserId();
  useEffect(() => {
    if (me.data?.id && !getUserId()) void setUserId(me.data.id).catch(() => {});
  }, [me.data?.id]);

  // What the last launch left on disk; only ever shown for the same account.
  const [cache, setCache] = useState<CardCache | null>(null);
  useEffect(() => {
    loadCardToken()
      .then(setCache)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (card.data?.token && uid) void saveCardToken(uid, card.data.token).catch(() => {});
  }, [card.data?.token, uid]);

  // A clock, so a token that was fine a minute ago can turn stale while the tab stays open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!focused) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, [focused]);

  const view = pickCardToken(
    card.data?.token ? { token: card.data.token, at: card.dataUpdatedAt } : null,
    cache,
    uid,
    now,
  );
  const usable = view && !view.stale ? view.token : null;

  // 288pt card with a 224pt code on a normal phone; both shrink on a 320pt one.
  const box = Math.min(288, width - 64);
  const qr = box - 56;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} className="text-center text-2xl font-semibold text-gray-900 dark:text-white">
          {t("card.title")}
        </Text>
        <Text maxFontSizeMultiplier={1.5} className="mt-2 text-center text-gray-600 dark:text-gray-300">
          {t("card.subtitle")}
        </Text>

        {/* Always white, in inverted mode too: a scanner needs a light margin
            round the code, and Smart Invert must not flip it. */}
        <View
          className="mt-10 items-center justify-center rounded-3xl border border-gray-100 bg-white p-7"
          accessibilityIgnoresInvertColors
          style={{
            width: box,
            height: box,
            shadowColor: "#04107E",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          {usable ? (
            <View accessible accessibilityRole="image" accessibilityLabel={t("card.qrLabel")}>
              <QRCode
                value={usable}
                size={qr}
                color="#04107E"
                backgroundColor="#fff"
                logo={IMAGES.logoIcon}
                logoSize={Math.round(qr * 0.23)}
                logoBackgroundColor="#fff"
                logoBorderRadius={10}
                logoMargin={4}
              />
            </View>
          ) : card.isFetching || (card.isLoading && !view) ? (
            <Spinner />
          ) : (
            // No token, or one too old to trust: say what to do, offer a retry.
            <View className="items-center gap-2">
              <Icon name="cloud-offline-outline" size={28} color="#6B7280" />
              <Text accessibilityLiveRegion="polite" className="text-center text-gray-700">
                {view?.stale ? t("card.stale") : t("card.loadError")}
              </Text>
              <Pressable
                onPress={() => card.refetch()}
                accessibilityRole="button"
                className="mt-1 min-h-[44px] justify-center rounded-xl bg-astra-primary px-5 py-2.5 active:opacity-80"
              >
                <Text chrome className="text-sm font-semibold text-white">
                  {t("common.retry")}
                </Text>
              </Pressable>
            </View>
          )}
          {/* A new token is being fetched: the old code stays under a veil, not live. */}
          {usable && card.isFetching ? (
            <View
              className="absolute inset-0 items-center justify-center rounded-3xl bg-white/80"
              pointerEvents="none"
            >
              <Spinner />
            </View>
          ) : null}
        </View>

        <Text maxFontSizeMultiplier={1.5} className="mt-8 text-center text-lg font-semibold text-gray-900 dark:text-white">
          {me.data?.name ?? t("card.memberFallback")}
        </Text>

        {/* Reassurance: the code refreshes on its own. Only once there is a code,
            or it contradicts the error above. */}
        {usable ? (
          <View className="mt-4 flex-row items-center gap-1.5">
            <Icon name="refresh" size={13} color="#6B7280" />
            <Text maxFontSizeMultiplier={1.4} className="flex-shrink text-center text-xs text-gray-600 dark:text-white/70">
              {t("card.autoRefresh")}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
