import { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  Image,
  Pressable,
  Alert,
  Modal,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Text } from "../components/AppText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { api } from "../lib/api";
import { useLocale, useT, useTn, type TranslationKey } from "../lib/i18n";
import { useRefresh } from "../lib/use-refresh";
import { errorCode, errorKind } from "../lib/api-errors";
import { announce } from "../lib/use-reduced-motion";
import { Icon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { SegmentedToggle } from "../components/SegmentedToggle";

type Voucher = { code: string | null; title: string };
type Tab = "available" | "redeemed";

/** A fresh key per purchase attempt; the server may use it to recognise a repeat. */
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Why a redeem failed, in the student's language, from the server's own error code. */
function failureMessage(error: unknown): TranslationKey {
  switch (errorCode(error)) {
    case "INSUFFICIENT_POINTS":
      return "rewards.errInsufficient";
    case "PER_USER_LIMIT":
      return "rewards.errLimit";
    case "OUT_OF_STOCK":
      return "rewards.errStock";
    case "BUSY":
      return "rewards.errBusy";
  }
  // No answer: the points may or may not have been spent.
  const kind = errorKind(error);
  return kind === "timeout" || kind === "network" ? "rewards.errUnknown" : "rewards.failedBody";
}

export default function RewardsScreen() {
  const t = useT();
  const tn = useTn();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const rewards = useQuery({ queryKey: ["rewards"], queryFn: () => api.rewards.list() });
  // No polling here: pull to refresh, or reopen the screen. Both lists refetch
  // when the app returns to the foreground (staleTime applies).
  const balance = useQuery({
    queryKey: ["points-balance"],
    queryFn: () => api.points.balance(),
  });
  const mine = useQuery({
    queryKey: ["redemptions"],
    queryFn: () => api.rewards.redemptions(),
  });

  const [tab, setTab] = useState<Tab>("available");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  // The code just copied: its button reads "Copied" for a moment instead of
  // interrupting with an alert.
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const refresh = useRefresh(rewards.refetch, balance.refetch, mine.refetch);

  // One key per reward until it is settled, so tapping again after a timeout is
  // the same purchase to the server, not a second one.
  const keys = useRef<Record<string, string>>({});

  async function copy(code: string) {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(code);
      announce(t("rewards.copiedTitle"));
    } catch {
      // clipboard unavailable: the code is on screen to read
    }
  }

  const items = rewards.data?.items ?? [];
  // Undefined while loading, so nothing flashes as unaffordable.
  const points = balance.data?.balance;
  const redemptions = mine.data?.items ?? [];

  function confirm(reward: { id: string; title: string; costPoints: number }) {
    Alert.alert(
      t("rewards.confirmTitle"),
      t("rewards.confirmBody", {
        title: reward.title,
        points: reward.costPoints.toLocaleString(locale),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("rewards.redeem"), onPress: () => redeem(reward) },
      ],
    );
  }

  function refreshAfterRedeem() {
    void qc.invalidateQueries({ queryKey: ["points-balance"] });
    void qc.invalidateQueries({ queryKey: ["rewards"] });
    void qc.invalidateQueries({ queryKey: ["redemptions"] });
    void qc.invalidateQueries({ queryKey: ["points-history"] });
  }

  async function redeem(reward: { id: string; title: string }) {
    setBusyId(reward.id);
    const key = (keys.current[reward.id] ??= newKey());
    try {
      const res = await api.rewards.redeem(reward.id, key);
      delete keys.current[reward.id];
      // The student has paid: show the voucher at once and refresh behind it,
      // rather than waiting on four requests over a slow link.
      setVoucher({ code: res.code, title: reward.title });
      announce(t("rewards.redeemedTitle"));
      refreshAfterRedeem();
    } catch (e) {
      const unknown = errorKind(e) === "timeout" || errorKind(e) === "network";
      // A definite answer settles the attempt; no answer leaves the key for the retry.
      if (!unknown) delete keys.current[reward.id];
      // If the request got through, the new voucher and balance are on the server.
      if (unknown) refreshAfterRedeem();
      Alert.alert(t("rewards.failedTitle"), t(failureMessage(e)));
    } finally {
      setBusyId(null);
    }
  }

  const header = <ScreenHeader title={t("rewards.title")} subtitle={t("rewards.subtitle")} />;

  if (rewards.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
        {header}
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  if (rewards.isError && !rewards.data) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
        {header}
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => rewards.refetch() }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      {header}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14 }}
        refreshControl={<RefreshControl {...refresh} />}
      >
        {/* Balance banner */}
        <View className="flex-row items-center justify-between rounded-2xl bg-astra-primary dark:bg-astra-dark px-5 py-4">
          <View>
            <Text className="text-xs text-white/80">{t("rewards.yourPoints")}</Text>
            <Text maxFontSizeMultiplier={1.5} className="mt-0.5 text-2xl font-semibold text-white">
              {points == null ? (balance.isError ? "–" : <Text accessibilityLabel={t("common.loading")}>…</Text>) : points.toLocaleString(locale)}
            </Text>
          </View>
          <Icon name="gift" size={26} color="rgba(255,255,255,0.85)" />
        </View>

        <SegmentedToggle
          value={tab}
          onChange={setTab}
          options={[
            { value: "available", label: t("rewards.tabAvailable") },
            { value: "redeemed", label: t("rewards.tabRedeemed") },
          ]}
        />

        {tab === "redeemed" ? (
          mine.isError && !mine.data ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={t("common.error")}
              action={{ label: t("common.retry"), onPress: () => mine.refetch() }}
            />
          ) : redemptions.length === 0 ? (
            <EmptyState
              icon="ticket-outline"
              title={t("rewards.noneRedeemedTitle")}
              body={t("rewards.noneRedeemedBody")}
            />
          ) : (
            redemptions.map((r) => (
              <View
                key={r.id}
                className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4"
              >
                <View className="flex-row items-start gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
                    <Icon name="ticket" size={21} color="#04107E" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">
                      {r.rewardTitle}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-600 dark:text-white/70">
                      {new Date(r.createdAt).toLocaleDateString(locale)} ·{" "}
                      {tn("rewards.spentPoints", r.costPoints, { points: r.costPoints.toLocaleString(locale) })}
                    </Text>
                  </View>
                </View>

                {r.code ? (
                  <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-astra-light dark:bg-white/10 px-3 py-2.5">
                    <Text selectable className="flex-1 font-mono text-[15px] font-bold text-astra-primary dark:text-white">
                      {r.code}
                    </Text>
                    <Pressable
                      onPress={() => copy(r.code!)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("common.copy")}, ${r.rewardTitle}`}
                      className="min-h-[44px] justify-center rounded-lg bg-astra-primary dark:bg-astra-dark px-3 py-1.5 active:opacity-80"
                    >
                      <Text chrome className="text-xs font-semibold text-white">
                        {copied === r.code ? t("rewards.copiedTitle") : t("common.copy")}
                      </Text>
                    </Pressable>
                  </View>
                ) : r.status === "CANCELLED" ? (
                  <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2.5">
                    <Icon name="close-circle-outline" size={16} color="#6B7280" />
                    <Text className="flex-1 text-[13px] text-gray-700 dark:text-gray-300">
                      {t("rewards.cancelledRefunded")}
                    </Text>
                  </View>
                ) : r.status === "FULFILLED" ? (
                  <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-green-50 dark:bg-green-500/15 px-3 py-2.5">
                    <Icon name="checkmark-circle-outline" size={16} color="#15803d" />
                    <Text className="flex-1 text-[13px] text-green-800 dark:text-green-200">
                      {t("rewards.collected")}
                    </Text>
                  </View>
                ) : (
                  // Still to be handed over. The reference is what staff search
                  // for in the backoffice, so it is shown rather than hidden.
                  <View className="mt-3 gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/15 px-3 py-2.5">
                    <View className="flex-row items-center gap-2">
                      <Icon name="time-outline" size={16} color="#b45309" />
                      <Text className="flex-1 text-[13px] text-amber-800 dark:text-amber-200">
                        {t("rewards.pendingFulfilment")}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text maxFontSizeMultiplier={1.3} className="text-[11px] uppercase tracking-wide text-amber-800 dark:text-amber-300">
                        {t("rewards.pickupRef")}
                      </Text>
                      <Text selectable className="font-mono text-[15px] font-bold text-amber-900 dark:text-amber-100">
                        {r.pickupRef}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))
          )
        ) : items.length === 0 ? (
          <EmptyState icon="gift-outline" title={t("rewards.emptyTitle")} body={t("rewards.emptyBody")} />
        ) : (
          items.map((r) => {
            const affordable = points != null && points >= r.costPoints;
            const soldOut = r.stock !== null && r.stock <= 0;
            // Show the per-account cap up front rather than letting them tap
            // through and fail — they'd have no idea why.
            const minesCount = redemptions.filter((x) => x.rewardId === r.id).length;
            const capped = r.perUserLimit !== null && minesCount >= r.perUserLimit;
            const busy = busyId === r.id;
            const blocked = !affordable || soldOut || capped;
            const label = capped
              ? t("rewards.alreadyRedeemed")
              : soldOut
                ? t("rewards.soldOut")
                : affordable
                  ? t("rewards.redeem")
                  : points == null
                    ? "…"
                    : tn("rewards.morePoints", r.costPoints - points, {
                        points: (r.costPoints - points).toLocaleString(locale),
                      });
            return (
              <View
                key={r.id}
                className="gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4"
                style={{
                  shadowColor: "#04107E",
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center gap-4">
                  {r.imageUrl ? (
                    <Image
                      source={{ uri: r.imageUrl }}
                      resizeMode="cover"
                      style={{ width: 64, height: 64, borderRadius: 14 }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
                      <Icon name="gift-outline" size={26} color="#04107E" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">
                      {r.title}
                    </Text>
                    {r.description ? (
                      <Text
                        className="mt-0.5 text-xs text-gray-600 dark:text-gray-300"
                        numberOfLines={3}
                      >
                        {r.description}
                      </Text>
                    ) : null}
                    {r.stock !== null && r.stock > 0 && (
                      <Text maxFontSizeMultiplier={1.3} className="mt-1 text-[11px] text-gray-600 dark:text-white/70">
                        {tn("rewards.leftCount", r.stock, { count: String(r.stock) })}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text maxFontSizeMultiplier={1.4} className="text-lg font-semibold text-astra-primary dark:text-white">
                      {r.costPoints.toLocaleString(locale)}
                    </Text>
                    <Text maxFontSizeMultiplier={1.3} className="text-[11px] text-gray-600 dark:text-white/70">
                      {t("rewards.pointsLabel")}
                    </Text>
                  </View>
                </View>

                {/* Unavailable is the same button, dimmed: it reads in both modes. */}
                <Pressable
                  disabled={blocked || busy}
                  onPress={() => confirm(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${r.title}`}
                  accessibilityState={{ disabled: blocked || busy, busy }}
                  className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-astra-primary dark:bg-white/15 py-3 active:opacity-80 ${
                    blocked ? "opacity-40" : ""
                  }`}
                >
                  {busy ? <Spinner color="#fff" /> : null}
                  <Text chrome className="text-sm font-semibold text-white">
                    {label}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Voucher handed out */}
      <Modal
        visible={voucher !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVoucher(null)}
      >
        <View
          style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(0,0,0,0.6)", padding: 28 }]}
          accessibilityViewIsModal
        >
          <ScrollView
            style={{ maxHeight: "100%", width: "100%", maxWidth: 340, flexGrow: 0 }}
            contentContainerStyle={{ flexGrow: 0 }}
            bounces={false}
          >
            <View className="w-full items-center rounded-3xl bg-white dark:bg-astra-dark p-7">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
                <Icon name="checkmark" size={34} color="#15803d" />
              </View>
              <Text accessibilityRole="header" className="mt-4 text-center text-xl font-semibold text-gray-900 dark:text-white">
                {t("rewards.redeemedTitle")}
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-600 dark:text-gray-300">
                {voucher?.title}
              </Text>

              {voucher?.code ? (
                <>
                  <Text maxFontSizeMultiplier={1.3} className="mt-5 text-[11px] uppercase tracking-wide text-gray-600 dark:text-white/70">
                    {t("rewards.yourCode")}
                  </Text>
                  <Text selectable className="mt-1 text-center font-mono text-xl font-bold text-astra-primary dark:text-white">
                    {voucher.code}
                  </Text>
                  <Pressable
                    onPress={() => copy(voucher.code!)}
                    accessibilityRole="button"
                    className="mt-3 min-h-[44px] w-full items-center justify-center rounded-xl bg-astra-light dark:bg-white/10 py-2.5 active:opacity-70"
                  >
                    <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">
                      {copied === voucher.code ? t("rewards.copiedTitle") : t("rewards.copyCode")}
                    </Text>
                  </Pressable>
                  <Text className="mt-3 text-center text-[12px] leading-4 text-gray-600 dark:text-white/70">
                    {t("rewards.codeHint")}
                  </Text>
                </>
              ) : (
                <Text className="mt-4 text-center text-sm text-gray-700 dark:text-gray-300">
                  {t("rewards.pendingBody")}
                </Text>
              )}

              <Pressable
                onPress={() => setVoucher(null)}
                accessibilityRole="button"
                className="mt-5 min-h-[48px] w-full items-center justify-center rounded-xl bg-astra-primary dark:bg-white/15 py-3 active:opacity-90"
              >
                <Text chrome className="font-semibold text-white">{t("common.done")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
