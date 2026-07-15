import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../lib/api";

// Home — shows the result of GET /api/me.
// NOTE: /api/me returns 501 in the scaffold (deferred with auth + DB), so the
// query will surface an error until US-002 lands. That's expected.
export default function HomeScreen() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
    retry: false,
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 gap-4 px-6 pt-8">
        <Text className="text-2xl font-semibold text-astra-primary">Home</Text>

        {isLoading && <Text className="text-gray-500">Loading /api/me…</Text>}
        {error && (
          <Text className="text-astra-accent">
            {String(error)} (expected until US-002 implements /api/me)
          </Text>
        )}
        {data && (
          <Text className="text-gray-800">{JSON.stringify(data, null, 2)}</Text>
        )}

        <Pressable
          className="rounded-lg border border-gray-300 px-4 py-3"
          onPress={() => refetch()}
        >
          <Text className="text-center">Retry /api/me</Text>
        </Pressable>

        <Pressable
          className="rounded-lg px-4 py-3"
          onPress={() => router.replace("/")}
        >
          <Text className="text-center text-gray-500">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
