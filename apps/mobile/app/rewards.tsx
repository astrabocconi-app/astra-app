import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api } from "../lib/api";
import { useT } from "../lib/i18n";
import { Icon } from "../components/Icon";
import { SegmentedToggle } from "../components/SegmentedToggle";

type Voucher = { code: string | null; title: string };
type Tab = "available" | "redeemed";

export default function RewardsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const rewards = useQuery({ queryKey: ["rewards"], queryFn: () => api.rewards.list(), retry: false });
  const balance = useQuery({
    queryKey: ["points-balance"],
    queryFn: () => api.points.balance(),
    retry: false,
    refetchInterval: 30_000,
  });
  const mine = useQuery({
    queryKey: ["redemptions"],
    queryFn: () => api.rewards.redemptions(),
    retry: false,
  });

  const [tab, setTab] = useState<Tab>("available");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);

  const items = rewards.data?.items ?? [];
  const points = balance.data?.balance ?? 0;
  const redemptions = mine.data?.items ?? [];

  function confirm(reward: { id: string; title: string; costPoints: number }) {
    Alert.alert(
      t("rewards.confirmTitle"),
      t("rewards.confirmBody", {
        title: reward.title,
        points: reward.costPoints.toLocaleString(),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("rewards.redeem"), onPress: () => redeem(reward) },
      ],
    );
  }

  async function redeem(reward: { id: string; title: string }) {
    setBusyId(reward.id);
    try {
      const res = await api.rewards.redeem(reward.id);
      // Refresh balance, catalogue (stock) and the voucher list together.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["points-balance"] }),
        qc.invalidateQueries({ queryKey: ["rewards"] }),
        qc.invalidateQueries({ queryKey: ["redemptions"] }),
        qc.invalidateQueries({ queryKey: ["points-history"] }),
      ]);
      setVoucher({ code: res.code, title: reward.title });
    } catch (e) {
      Alert.alert(
        t("rewards.failedTitle"),
        e instanceof Error ? e.message : t("rewards.failedBody"),
      );
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <View className="flex-row items-center gap-2 border-b border-gray-100 dark:border-white/10 px-4 py-3">
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Icon name="chevron-back" size={26} color="#04107E" />
      </Pressable>
      <View>
        <Text className="text-lg font-semibold text-astra-primary dark:text-white">
          {t("rewards.title")}
        </Text>
        <Text className="text-xs text-gray-400 dark:text-white/60">{t("rewards.subtitle")}</Text>
      </View>
    </View>
  );

  if (rewards.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
        {header}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#04107E" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      {header}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14 }}
      >
        {/* Balance banner */}
        <View className="flex-row items-center justify-between rounded-2xl bg-astra-primary dark:bg-astra-dark px-5 py-4">
          <View>
            <Text className="text-xs uppercase tracking-wide text-white/70">
              {t("rewards.yourPoints")}
            </Text>
            <Text className="mt-0.5 text-2xl font-bold text-white">{points.toLocaleString()}</Text>
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
          redemptions.length === 0 ? (
            <View className="mt-10 items-center gap-3 px-4">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
                <Icon name="ticket-outline" size={30} color="#04107E" />
              </View>
              <Text className="text-xl font-semibold text-astra-primary dark:text-white">
                {t("rewards.noneRedeemedTitle")}
              </Text>
              <Text className="text-center text-gray-500 dark:text-gray-300">
                {t("rewards.noneRedeemedBody")}
              </Text>
            </View>
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
                    <Text className="mt-0.5 text-xs text-gray-400 dark:text-white/60">
                      {new Date(r.createdAt).toLocaleDateString()} ·{" "}
                      {t("rewards.spentPoints", { points: r.costPoints.toLocaleString() })}
                    </Text>
                  </View>
                </View>

                {r.code ? (
                  <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-astra-light dark:bg-white/10 px-3 py-2.5">
                    <Text className="flex-1 font-mono text-[15px] font-bold text-astra-primary dark:text-white">
                      {r.code}
                    </Text>
                    <Pressable
                      onPress={async () => {
                        await Clipboard.setStringAsync(r.code!);
                        Alert.alert(t("rewards.copiedTitle"));
                      }}
                      hitSlop={8}
                      className="rounded-lg bg-astra-primary dark:bg-astra-dark px-3 py-1.5 active:opacity-80"
                    >
                      <Text className="text-xs font-semibold text-white">{t("common.copy")}</Text>
                    </Pressable>
                  </View>
                ) : r.status === "CANCELLED" ? (
                  <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2.5">
                    <Icon name="close-circle-outline" size={16} color="#6B7280" />
                    <Text className="flex-1 text-[13px] text-gray-600 dark:text-gray-300">
                      {t("rewards.cancelledRefunded")}
                    </Text>
                  </View>
                ) : r.status === "FULFILLED" ? (
                  <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-green-50 dark:bg-green-500/15 px-3 py-2.5">
                    <Icon name="checkmark-circle-outline" size={16} color="#16a34a" />
                    <Text className="flex-1 text-[13px] text-green-800 dark:text-green-200">
                      {t("rewards.collected")}
                    </Text>
                  </View>
                ) : (
                  // Still to be handed over. The reference is what staff search
                  // for in the backoffice, so it is shown rather than hidden.
                  <View className="mt-3 gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/15 px-3 py-2.5">
                    <View className="flex-row items-center gap-2">
                      <Icon name="time-outline" size={16} color="#d97706" />
                      <Text className="flex-1 text-[13px] text-amber-800 dark:text-amber-200">
                        {t("rewards.pendingFulfilment")}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        {t("rewards.pickupRef")}
                      </Text>
                      <Text className="font-mono text-[15px] font-bold text-amber-900 dark:text-amber-100">
                        {r.pickupRef}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))
          )
        ) : items.length === 0 ? (
          <View className="mt-10 items-center gap-3 px-4">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
              <Icon name="gift-outline" size={30} color="#04107E" />
            </View>
            <Text className="text-xl font-semibold text-astra-primary dark:text-white">
              {t("rewards.emptyTitle")}
            </Text>
            <Text className="text-center text-gray-500 dark:text-gray-300">
              {t("rewards.emptyBody")}
            </Text>
          </View>
        ) : (
          items.map((r) => {
            const affordable = points >= r.costPoints;
            const soldOut = r.stock !== null && r.stock <= 0;
            // Show the per-account cap up front rather than letting them tap
            // through and fail — they'd have no idea why.
            const minesCount = redemptions.filter((x) => x.rewardId === r.id).length;
            const capped = r.perUserLimit !== null && minesCount >= r.perUserLimit;
            const busy = busyId === r.id;
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
                        className="mt-0.5 text-xs text-gray-500 dark:text-gray-300"
                        numberOfLines={2}
                      >
                        {r.description}
                      </Text>
                    ) : null}
                    {r.stock !== null && r.stock > 0 && (
                      <Text className="mt-1 text-[11px] text-gray-400 dark:text-white/60">
                        {t("rewards.leftCount", { count: String(r.stock) })}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-bold text-astra-primary dark:text-white">
                      {r.costPoints.toLocaleString()}
                    </Text>
                    <Text className="text-[11px] text-gray-400 dark:text-white/60">
                      {t("rewards.pointsLabel")}
                    </Text>
                  </View>
                </View>

                <Pressable
                  disabled={!affordable || soldOut || capped || busy}
                  onPress={() => confirm(r)}
                  className="items-center rounded-xl py-3 active:opacity-80"
                  style={{
                    backgroundColor: !affordable || soldOut || capped ? "#E5E7EB" : "#04107E",
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      className={`text-sm font-semibold ${
                        !affordable || soldOut || capped ? "text-gray-500" : "text-white"
                      }`}
                    >
                      {capped
                        ? t("rewards.alreadyRedeemed")
                        : soldOut
                          ? t("rewards.soldOut")
                          : affordable
                            ? t("rewards.redeem")
                            : t("rewards.morePoints", {
                                points: (r.costPoints - points).toLocaleString(),
                              })}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Voucher handed out */}
      <Modal visible={voucher !== null} transparent animationType="fade">
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(0,0,0,0.6)", padding: 28 }]}>
          <View
            className="w-full items-center rounded-3xl bg-white dark:bg-astra-dark p-7"
            style={{ maxWidth: 340 }}
          >
            <View className="h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
              <Icon name="checkmark" size={34} color="#16a34a" />
            </View>
            <Text className="mt-4 text-center text-xl font-bold text-gray-900 dark:text-white">
              {t("rewards.redeemedTitle")}
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-300">
              {voucher?.title}
            </Text>

            {voucher?.code ? (
              <>
                <Text className="mt-5 text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/60">
                  {t("rewards.yourCode")}
                </Text>
                <Text className="mt-1 text-center font-mono text-xl font-bold text-astra-primary dark:text-white">
                  {voucher.code}
                </Text>
                <Pressable
                  onPress={async () => {
                    await Clipboard.setStringAsync(voucher.code!);
                    Alert.alert(t("rewards.copiedTitle"));
                  }}
                  className="mt-3 w-full items-center rounded-xl bg-astra-light dark:bg-white/10 py-2.5 active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-astra-primary dark:text-white">
                    {t("rewards.copyCode")}
                  </Text>
                </Pressable>
                <Text className="mt-3 text-center text-[11px] leading-4 text-gray-400 dark:text-white/60">
                  {t("rewards.codeHint")}
                </Text>
              </>
            ) : (
              <Text className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                {t("rewards.pendingBody")}
              </Text>
            )}

            <Pressable
              onPress={() => setVoucher(null)}
              className="mt-5 w-full items-center rounded-xl bg-astra-primary dark:bg-white/15 py-3 active:opacity-90"
            >
              <Text className="font-semibold text-white">{t("common.done")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
