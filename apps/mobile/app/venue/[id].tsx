import { useEffect, useRef } from "react";
import { View, ScrollView, Pressable, Image, Linking, Platform, Alert } from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import type { PartnerItem } from "@astra/shared";
import { Icon, Spinner } from "../../components/Icon";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { offerBadge, openOfferLink, trackVenue } from "../../lib/offer";
import { useEggStore } from "../../lib/egg-store";

function openDirections(p: PartnerItem, onFail: () => void) {
  const query = p.address?.trim()
    ? encodeURIComponent(`${p.name}, ${p.address}`)
    : p.latitude != null && p.longitude != null
      ? `${p.latitude},${p.longitude}`
      : encodeURIComponent(p.name);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  if (url) Linking.openURL(url).catch(onFail);
}

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const inverted = useEggStore((s) => s.inverted);
  // Reuses the Discounts screen's own cached list — opening a venue never
  // fires a fresh network request, it just reads what's already in memory.
  const partners = useQuery({ queryKey: ["partners"], queryFn: () => api.partners.list() });
  const venue = partners.data?.items.find((p) => p.id === id);
  const directions = (p: PartnerItem) => {
    trackVenue({ partnerId: p.id, kind: "DIRECTIONS" });
    openDirections(p, () => Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody")));
  };
  // One view per visit to this page, once the venue is known.
  const counted = useRef(false);
  useEffect(() => {
    if (!venue || counted.current) return;
    counted.current = true;
    trackVenue({ partnerId: venue.id, kind: "VIEW" });
  }, [venue]);
  async function openLink(o: PartnerItem["offers"][number]) {
    if (!venue) return;
    const ok = await openOfferLink(venue.id, o);
    if (!ok) Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody"));
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title="" />

      {partners.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : partners.isError && !partners.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => partners.refetch() }}
        />
      ) : !venue ? (
        <EmptyState icon="storefront-outline" title={t("venue.notAvailable")} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {venue.photoUrl ? (
            <Image
              source={{ uri: venue.photoUrl }}
              resizeMode="cover"
              style={{ width: "100%", aspectRatio: 16 / 9 }}
              accessibilityIgnoresInvertColors
            />
          ) : null}

          <View className="px-5 pt-5">
            <View className="flex-row items-start gap-3">
              {venue.logoUrl ? (
                <Image
                  source={{ uri: venue.logoUrl }}
                  resizeMode="cover"
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
                  <Icon name="storefront" size={21} color="#04107E" />
                </View>
              )}
              <View className="flex-1">
                <Text accessibilityRole="header" className="text-2xl font-semibold text-gray-900 dark:text-white">{venue.name}</Text>
                {venue.category ? (
                  <Text className="mt-0.5 text-xs font-medium text-gray-500 dark:text-white/70">{venue.category}</Text>
                ) : null}
              </View>
            </View>

            {venue.address ? (
              <Pressable
                className="mt-3 min-h-[44px] flex-row items-center gap-2 py-1.5 active:opacity-60"
                onPress={() => directions(venue)}
                hitSlop={8}
                accessibilityRole="link"
              >
                <Icon name="location-outline" size={16} color="#04107E" />
                <Text className="flex-1 text-sm font-medium text-astra-primary dark:text-white">
                  {venue.address}
                </Text>
              </Pressable>
            ) : null}

            {venue.description ? (
              <Text className="mt-4 text-base leading-6 text-gray-600 dark:text-gray-300">
                {venue.description}
              </Text>
            ) : null}

            {venue.offers.length > 0 ? (
              <View className="mt-6 gap-3">
                <Text accessibilityRole="header" className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t("venue.offersTitle")}
                </Text>
                {venue.offers.map((o) => {
                  const badge = offerBadge(o);
                  return (
                  <View
                    key={o.id}
                    className="gap-2 rounded-2xl border border-gray-100 dark:border-white/10 p-4"
                  >
                    {badge ? (
                      <View className="self-start rounded-full bg-astra-light dark:bg-white/10 px-2.5 py-1">
                        <Text maxFontSizeMultiplier={1.3} className="text-[12px] font-semibold text-astra-primary dark:text-white" numberOfLines={1}>
                          {badge}
                        </Text>
                      </View>
                    ) : null}
                    <Text className="text-[15px] font-semibold leading-5 text-gray-900 dark:text-white">{o.title}</Text>
                    {o.description ? (
                      <Text className="text-[13px] leading-5 text-gray-600 dark:text-gray-300">{o.description}</Text>
                    ) : null}
                    {o.linkUrl ? (
                      <Pressable
                        onPress={() => openLink(o)}
                        accessibilityRole="link"
                        accessibilityHint={t("links.opensBrowser")}
                        className="mt-1 min-h-[46px] flex-row items-center justify-center gap-2 rounded-xl bg-astra-primary dark:bg-white px-4 py-3 active:opacity-85"
                      >
                        <Text chrome className="text-[15px] font-semibold text-white dark:text-astra-primary" numberOfLines={1}>
                          {o.linkLabel || t("offer.getOffer")}
                        </Text>
                        <Icon name="open-outline" size={16} color={inverted ? "#04107E" : "#FFFFFF"} />
                      </Pressable>
                    ) : null}
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <Icon
                        name={o.qrEnabled ? "qr-code-outline" : "hand-left-outline"}
                        size={13}
                        color="#9CA3AF"
                      />
                      <Text className="text-[11px] text-gray-600 dark:text-white/70">
                        {o.qrEnabled ? t("venue.qrEnabled") : t("venue.qrDisabled")}
                      </Text>
                    </View>
                  </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {venue?.latitude != null && venue?.longitude != null ? (
        <View
          className="border-t border-gray-100 dark:border-white/10 px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Button
            label={t("venue.directions")}
            onPress={() => directions(venue)}
            icon={<Icon name="navigate" size={18} color="#fff" />}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
