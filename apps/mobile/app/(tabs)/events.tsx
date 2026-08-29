import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function EventsScreen() {
  const t = useT();
  const events = useQuery({ queryKey: ["events"], queryFn: () => api.events.list(), retry: false });
  const items = events.data?.items ?? [];

  if (events.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-astra-primary">
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-white dark:bg-astra-primary px-8">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
          <Icon name="calendar-outline" size={30} color="#04107E" />
        </View>
        <Text className="text-xl font-semibold text-astra-primary dark:text-white">{t("events.emptyTitle")}</Text>
        <Text className="text-center text-gray-500 dark:text-gray-300">
          {t("events.emptyBody")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-astra-primary" contentContainerStyle={{ padding: 20, gap: 14 }}>
      {items.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => router.push(`/event/${e.id}`)}
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
            <Image source={{ uri: e.imageUrl }} resizeMode="cover" style={{ width: "100%", aspectRatio: 16 / 9 }} />
          ) : (
            <View style={{ height: 96, backgroundColor: "#04107E" }} className="items-center justify-center">
              <Icon name="sparkles" size={28} color="rgba(255,255,255,0.9)" />
            </View>
          )}
          <View className="p-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{e.title}</Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Icon name="time-outline" size={13} color="#6B7280" />
              <Text className="text-xs text-gray-500 dark:text-gray-300">{formatWhen(e.startsAt)}</Text>
            </View>
            {e.location ? (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Icon name="location-outline" size={13} color="#6B7280" />
                <Text className="text-xs text-gray-500 dark:text-gray-300">{e.location}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
