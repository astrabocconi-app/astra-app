import { View, ScrollView, Pressable, Image, RefreshControl } from "react-native";
import { Text } from "../../components/AppText";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon, Spinner } from "../../components/Icon";
import { EmptyState } from "../../components/EmptyState";
import { queries } from "../../lib/prefetch";
import { useLocale, useT } from "../../lib/i18n";
import { useRefresh } from "../../lib/use-refresh";

function formatWhen(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export default function EventsScreen() {
  const t = useT();
  const locale = useLocale();
  const events = useQuery(queries.events());
  const refresh = useRefresh(events.refetch);
  const items = events.data?.items ?? [];

  if (events.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-astra-primary">
        <Spinner />
      </View>
    );
  }

  // Error before empty: offline must not read as "no events". A failed refresh
  // that still has events to show keeps showing them.
  if ((events.isError && !events.data) || items.length === 0) {
    return (
      <View className="flex-1 bg-white dark:bg-astra-primary">
        {events.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t("common.error")}
            action={{ label: t("common.retry"), onPress: () => events.refetch() }}
          />
        ) : (
          <EmptyState icon="calendar-outline" title={t("events.emptyTitle")} body={t("events.emptyBody")} />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-astra-primary"
      contentContainerStyle={{ padding: 20, gap: 14 }}
      refreshControl={<RefreshControl {...refresh} />}
    >
      {items.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => router.push(`/event/${e.id}`)}
          accessibilityRole="button"
          className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary active:opacity-90"
          style={{
            shadowColor: "#04107E",
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          {e.imageUrl ? (
            <Image
              source={{ uri: e.imageUrl }}
              resizeMode="cover"
              style={{ width: "100%", aspectRatio: 16 / 9 }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
          {/* No cover: a small icon tile beside the text rather than a filler hero. */}
          <View className="flex-row items-start gap-3 p-4">
            {e.imageUrl ? null : (
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
                <Icon name="calendar-outline" size={21} color="#04107E" />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={3}>
                {e.title}
              </Text>
              {e.appDiscountPercent ? (
                <View className="mt-1 self-start rounded-full bg-astra-light dark:bg-white/10 px-2 py-0.5">
                  <Text maxFontSizeMultiplier={1.3} className="text-[11px] font-semibold text-astra-primary dark:text-white">
                    {t("event.appDiscountShort", { n: String(e.appDiscountPercent) })}
                  </Text>
                </View>
              ) : null}
              <View className="mt-1 flex-row items-center gap-1.5">
                <Icon name="time-outline" size={13} color="#6B7280" />
                <Text className="flex-1 text-xs text-gray-600 dark:text-gray-300">{formatWhen(e.startsAt, locale)}</Text>
              </View>
              {e.location ? (
                <View className="mt-1 flex-row items-center gap-1.5">
                  <Icon name="location-outline" size={13} color="#6B7280" />
                  <Text className="flex-1 text-xs text-gray-600 dark:text-gray-300" numberOfLines={2}>
                    {e.location}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
