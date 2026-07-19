import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { clearToken } from "../../lib/session";

export default function ProfileScreen() {
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
    <View className="flex-1 bg-white p-5">
      {isLoading && <ActivityIndicator />}

      {error && (
        <View className="gap-2">
          <Text className="text-red-600">{String((error as Error).message)}</Text>
          <Pressable className="rounded-lg border border-gray-300 px-4 py-3" onPress={() => refetch()}>
            <Text className="text-center">Retry</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <View className="items-center gap-3 pt-4">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-astra-light">
            <Ionicons name="person" size={36} color="#04107E" />
          </View>
          <Text className="text-xl font-semibold text-gray-900">{data.name ?? "Student"}</Text>
          <Text className="text-gray-500">{data.email}</Text>
          <View className="mt-1 flex-row gap-2">
            {data.roles.map((r) => (
              <Text
                key={r}
                className="rounded-full bg-astra-light px-3 py-1 text-xs font-medium text-astra-primary"
              >
                {r}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Services */}
      <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Services
      </Text>
      <Pressable
        className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
        onPress={() => router.push("/classrooms")}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
          <Ionicons name="school-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">Find a free classroom</Text>
          <Text className="text-xs text-gray-500">Live room availability · Free@B</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      <View className="flex-1" />

      <Pressable
        className="flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3"
        onPress={signOut}
      >
        <Ionicons name="log-out-outline" size={18} color="#6B7280" />
        <Text className="text-center font-medium text-gray-600">Sign out</Text>
      </Pressable>
    </View>
  );
}
