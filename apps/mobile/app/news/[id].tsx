import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const news = useQuery({ queryKey: ["news"], queryFn: () => api.news.list(), retry: false });
  const post = news.data?.items.find((n) => n.id === id);

  const when = post?.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <Pressable onPress={() => router.back()} className="flex-row items-center gap-1 px-4 py-2" hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#04107E" />
        <Text className="text-base font-medium text-astra-primary">Home</Text>
      </Pressable>

      {news.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !post ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-gray-500">This post is no longer available.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {post.imageUrl ? (
            <Image source={{ uri: post.imageUrl }} resizeMode="cover" style={{ width: "100%", aspectRatio: 2 / 1 }} />
          ) : null}
          <View className="px-5 pt-5">
            <Text className="text-2xl font-bold text-gray-900">{post.title}</Text>
            {when ? <Text className="mt-1 text-xs text-gray-400">{when}</Text> : null}
            <Text className="mt-4 text-base leading-6 text-gray-600">{post.body}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
