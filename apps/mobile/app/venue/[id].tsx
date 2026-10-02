import { View, Text, ScrollView, Pressable, Image, Linking, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import type { PartnerItem } from "@astra/shared";
import { Icon, Spinner } from "../../components/Icon";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";

function openDirections(p: PartnerItem) {
  const query = p.address?.trim()
    ? encodeURIComponent(`${p.name}, ${p.address}`)
    : p.latitude != null && p.longitude != null
      ? `${p.latitude},${p.longitude}`
      : encodeURIComponent(p.name);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  if (url) void Linking.openURL(url);
}

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  // Reuses the Discounts screen's own cached list — opening a venue never
  // fires a fresh network request, it just reads what's already in memory.
  const partners = useQuery({ queryKey: ["partners"], queryFn: () => api.partners.list(), retry: false });
  const venue = partners.data?.items.find((p) => p.id === id);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title="" />

      {partners.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : partners.isError ? (
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
            <Image source={{ uri: venue.photoUrl }} resizeMode="cover" style={{ width: "100%", aspectRatio: 16 / 9 }} />
          ) : null}

          <View className="px-5 pt-5">
            <View className="flex-row items-start gap-3">
              {venue.logoUrl ? (
                <Image
                  source={{ uri: venue.logoUrl }}
                  resizeMode="cover"
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                />
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
                  <Icon name="storefront" size={21} color="#04107E" />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-2xl font-semibold text-gray-900 dark:text-white">{venue.name}</Text>
                {venue.category ? (
                  <Text className="mt-0.5 text-xs font-medium text-gray-400 dark:text-white/60">{venue.category}</Text>
                ) : null}
              </View>
            </View>

            {venue.address ? (
              <Pressable
                className="mt-3 flex-row items-center gap-2 py-1.5 active:opacity-60"
                onPress={() => openDirections(venue)}
                hitSlop={8}
                accessibilityRole="link"
              >
                <Icon name="location-outline" size={16} color="#04107E" />
                <Text className="text-sm font-medium text-astra-primary dark:text-white">
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
                <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t("venue.offersTitle")}
                </Text>
                {venue.offers.map((o) => (
                  <View
                    key={o.id}
                    className="gap-1.5 rounded-2xl border border-gray-100 dark:border-white/10 p-4"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text
                        className="rounded-full bg-astra-light dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-astra-primary dark:text-white"
                        numberOfLines={1}
                      >
                        {o.label}
                      </Text>
                      <Text className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                        {o.title}
                      </Text>
                    </View>
                    {o.description ? (
                      <Text className="text-[13px] text-gray-500 dark:text-gray-400">{o.description}</Text>
                    ) : null}
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <Icon
                        name={o.qrEnabled ? "qr-code-outline" : "hand-left-outline"}
                        size={13}
                        color="#9CA3AF"
                      />
                      <Text className="text-[11px] text-gray-400 dark:text-white/60">
                        {o.qrEnabled ? t("venue.qrEnabled") : t("venue.qrDisabled")}
                      </Text>
                    </View>
                  </View>
                ))}
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
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-xl bg-astra-primary dark:bg-astra-dark py-3.5 active:opacity-90"
            onPress={() => openDirections(venue)}
          >
            <Icon name="navigate" size={18} color="#fff" />
            <Text className="text-base font-semibold text-white">{t("venue.directions")}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
