import { View, ScrollView, Image } from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Spinner } from "../../components/Icon";
import { ContentLinks } from "../../components/ContentLinks";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { api } from "../../lib/api";
import { useLocale, useT } from "../../lib/i18n";

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const news = useQuery({ queryKey: ["news"], queryFn: () => api.news.list() });
  const post = news.data?.items.find((n) => n.id === id);
  const t = useT();
  const locale = useLocale();

  const when = post?.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title="" />

      {news.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : news.isError && !news.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => news.refetch() }}
        />
      ) : !post ? (
        <EmptyState icon="newspaper-outline" title={t("news.notAvailable")} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {post.imageUrl ? (
            <Image
              source={{ uri: post.imageUrl }}
              resizeMode="cover"
              style={{ width: "100%", aspectRatio: 2 / 1 }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <View className="px-5 pt-5">
            <Text accessibilityRole="header" className="text-2xl font-semibold text-gray-900 dark:text-white">{post.title}</Text>
            {when ? <Text className="mt-1 text-xs text-gray-500 dark:text-white/70">{when}</Text> : null}
            <Text selectable className="mt-4 text-base leading-6 text-gray-600 dark:text-gray-300">
              {post.body}
            </Text>
            <ContentLinks links={post.links} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
