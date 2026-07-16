import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../lib/api";
import { clearToken } from "../lib/session";

// Home — shows the authenticated student's profile from GET /api/me.
export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
    retry: false,
  });

  async function signOut() {
    await clearToken();
    queryClient.clear();
    router.replace("/");
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 gap-4 px-6 pt-8">
        <Text className="text-2xl font-semibold text-astra-primary">Home</Text>

        {isLoading && <ActivityIndicator />}

        {error && (
          <View className="gap-2">
            <Text className="text-red-600">{String((error as Error).message)}</Text>
            <Pressable
              className="rounded-lg border border-gray-300 px-4 py-3"
              onPress={() => refetch()}
            >
              <Text className="text-center">Retry</Text>
            </Pressable>
          </View>
        )}

        {data && (
          <View className="gap-1 rounded-xl border border-gray-200 p-4">
            <Text className="text-lg font-medium text-gray-900">
              {data.name ?? "Student"}
            </Text>
            <Text className="text-gray-500">{data.email}</Text>
            <Text className="mt-2 text-xs uppercase tracking-wide text-gray-400">
              {data.roles.join(" · ")}
            </Text>
          </View>
        )}

        <View className="flex-1" />

        <Pressable className="rounded-lg px-4 py-3" onPress={signOut}>
          <Text className="text-center text-gray-500">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
