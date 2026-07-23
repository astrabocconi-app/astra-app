import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = useQuery({ queryKey: ["events"], queryFn: () => api.events.list(), retry: false });
  const event = events.data?.items.find((e) => e.id === id);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Back */}
      <Pressable onPress={() => router.back()} className="flex-row items-center gap-1 px-4 py-2" hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#04107E" />
        <Text className="text-base font-medium text-astra-primary">Events</Text>
      </Pressable>

      {events.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !event ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-gray-500">This event is no longer available.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} resizeMode="cover" style={{ width: "100%", height: 200 }} />
          ) : (
            <View style={{ height: 120, backgroundColor: "#04107E" }} className="items-center justify-center">
              <Ionicons name="sparkles" size={34} color="rgba(255,255,255,0.9)" />
            </View>
          )}

          <View className="px-5 pt-5">
            <Text className="text-2xl font-bold text-gray-900">{event.title}</Text>

            <View className="mt-3 gap-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="time-outline" size={16} color="#04107E" />
                <Text className="text-sm text-gray-700">{formatWhen(event.startsAt)}</Text>
              </View>
              {event.location ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={16} color="#04107E" />
                  <Text className="text-sm text-gray-700">{event.location}</Text>
                </View>
              ) : null}
            </View>

            {event.description ? (
              <Text className="mt-4 text-base leading-6 text-gray-600">{event.description}</Text>
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* Get tickets */}
      {event?.externalTicketUrl ? (
        <View className="border-t border-gray-100 px-5 pb-2 pt-3">
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-xl bg-astra-primary py-3.5 active:opacity-90"
            onPress={() => Linking.openURL(event.externalTicketUrl!)}
          >
            <Ionicons name="ticket-outline" size={18} color="#fff" />
            <Text className="text-base font-semibold text-white">Get tickets</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
