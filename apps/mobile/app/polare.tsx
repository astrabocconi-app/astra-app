import { memo, useCallback, useRef, useState } from "react";
import {
  View,
  Image,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
  useWindowDimensions,
  type ViewToken,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { PolareMedia, PolarePost } from "@astra/shared";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { Icon, Spinner } from "../components/Icon";
import { Text } from "../components/AppText";
import { IMAGES } from "../lib/assets";
import { api } from "../lib/api";
import { useLocale, useT } from "../lib/i18n";
import { useRefresh } from "../lib/use-refresh";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { videoSupported } from "../lib/video-support";

// Older binaries have no expo-video native module; importing it there throws, so
// the player is only required when the module exists.
const VideoPlayer: typeof import("../components/PolareVideoPlayer").default | null = videoSupported
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../components/PolareVideoPlayer").default
  : null;

type T = ReturnType<typeof useT>;

/** Instagram's own range: 4:5 portrait up to 5:4 landscape; anything taller or wider is cropped. */
function mediaRatio(media: PolareMedia[]): number {
  const m = media[0];
  const r = m?.width && m?.height ? m.width / m.height : 1;
  return Math.min(1.25, Math.max(0.8, r));
}

function openHttps(url: string) {
  if (/^https:\/\//.test(url)) Linking.openURL(url).catch(() => {});
}

const MediaItem = memo(function MediaItem({
  item,
  width,
  height,
  active,
  reducedMotion,
  t,
}: {
  item: PolareMedia;
  width: number;
  height: number;
  active: boolean;
  reducedMotion: boolean;
  t: T;
}) {
  const label = item.alt ?? undefined;
  if (item.type === "video") {
    return (
      <View style={{ width, height }} className="bg-black">
        {VideoPlayer ? (
          <VideoPlayer uri={item.url} posterUri={item.posterUrl} alt={item.alt} active={active} reducedMotion={reducedMotion} />
        ) : (
          <Pressable
            onPress={() => openHttps(item.url)}
            accessibilityRole="link"
            accessibilityLabel={`${t("polare.openVideo")}${label ? `, ${label}` : ""}`}
            className="flex-1 items-center justify-center"
          >
            {item.posterUrl ? (
              <Image source={{ uri: item.posterUrl }} resizeMode="cover" style={{ position: "absolute", width, height }} accessibilityIgnoresInvertColors />
            ) : null}
            <View className="flex-row items-center gap-2 rounded-full bg-black/60 px-4 py-2.5">
              <Icon name="play" size={18} color="#FFFFFF" />
              <Text chrome className="text-sm font-semibold text-white">
                {t("polare.openVideo")}
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    );
  }
  return (
    <Image
      source={{ uri: item.url }}
      resizeMode="cover"
      style={{ width, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? t("polare.photo")}
      accessibilityIgnoresInvertColors
      className="bg-gray-100 dark:bg-white/10"
    />
  );
});

const PostCard = memo(function PostCard({
  post,
  width,
  active,
  reducedMotion,
  locale,
  t,
}: {
  post: PolarePost;
  width: number;
  active: boolean;
  reducedMotion: boolean;
  locale: string;
  t: T;
}) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [index, setIndex] = useState(0);
  const height = Math.round(width / mediaRatio(post.media));
  const many = post.media.length > 1;
  const when = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : null;
  const kind = post.kind === "REEL" ? t("polare.reel") : post.kind === "CAROUSEL" ? t("polare.carousel") : t("polare.photo");

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width)),
    [width],
  );

  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <Image
          source={IMAGES.stellaPolare}
          style={{ width: 36, height: 36, borderRadius: 18 }}
          accessibilityIgnoresInvertColors
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-gray-900 dark:text-white">{t("polare.title")}</Text>
          {when ? <Text className="text-xs text-gray-500 dark:text-white/70">{when}</Text> : null}
        </View>
        {post.pinned ? (
          <View
            accessible
            accessibilityLabel={t("polare.pinned")}
            className="flex-row items-center gap-1 rounded-full bg-astra-light dark:bg-white/10 px-2.5 py-1"
          >
            <Icon name="pin" size={12} color="#04107E" />
            <Text chrome className="text-xs font-semibold text-astra-primary dark:text-white">
              {t("polare.pinned")}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{ width, height }}
        accessibilityLabel={many ? `${kind}, ${t("polare.slide", { n: String(index + 1), total: String(post.media.length) })}` : undefined}
      >
        {many ? (
          <>
            <FlatList
              data={post.media}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(m, i) => `${i}-${m.url}`}
              onMomentumScrollEnd={onScrollEnd}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              initialNumToRender={1}
              windowSize={3}
              renderItem={({ item, index: i }) => (
                <MediaItem item={item} width={width} height={height} active={active && i === index} reducedMotion={reducedMotion} t={t} />
              )}
              extraData={`${active}-${index}`}
            />
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1"
            >
              <Text chrome className="text-xs font-semibold text-white">
                {index + 1}/{post.media.length}
              </Text>
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5"
            >
              {post.media.map((_, i) => (
                <View key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
              ))}
            </View>
          </>
        ) : (
          <MediaItem item={post.media[0]!} width={width} height={height} active={active} reducedMotion={reducedMotion} t={t} />
        )}
      </View>

      {post.caption ? (
        <View className="px-4 pt-3">
          <Text
            numberOfLines={expanded ? undefined : 2}
            onTextLayout={(e) => {
              if (!expanded) setTruncated(e.nativeEvent.lines.length > 2);
            }}
            className="text-[15px] leading-[22px] text-gray-800 dark:text-gray-100"
          >
            {post.caption}
          </Text>
          {truncated || expanded ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={expanded ? t("polare.less") : t("polare.more")}
              className="min-h-[44px] justify-center self-start"
            >
              <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">
                {expanded ? t("polare.less") : t("polare.more")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {post.externalUrl ? (
        <Pressable
          onPress={() => openHttps(post.externalUrl!)}
          accessibilityRole="link"
          accessibilityLabel={t("polare.instagram")}
          className="mx-4 mt-1 min-h-[44px] flex-row items-center gap-2 self-start"
        >
          <Icon name="logo-instagram" size={18} color="#04107E" />
          <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">
            {t("polare.instagram")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

export default function PolareScreen() {
  const t = useT();
  const locale = useLocale();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const feed = useQuery({ queryKey: ["polare"], queryFn: () => api.polare.list() });
  const refresh = useRefresh(feed.refetch);
  const [activeId, setActiveId] = useState<string | null>(null);
  // FlatList wants a stable callback: changing it on the fly is an error.
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setActiveId((viewableItems[0]?.item as PolarePost | undefined)?.id ?? null);
  }).current;

  const items = feed.data?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("polare.title")} />
      {feed.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : feed.isError && !feed.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => feed.refetch() }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard post={item} width={width} active={item.id === activeId} reducedMotion={reducedMotion} locale={locale} t={t} />
          )}
          extraData={activeId}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={VIEWABILITY}
          refreshControl={<RefreshControl {...refresh} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="images-outline" title={t("polare.emptyTitle")} body={t("polare.emptyBody")} />}
          initialNumToRender={2}
          windowSize={5}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
