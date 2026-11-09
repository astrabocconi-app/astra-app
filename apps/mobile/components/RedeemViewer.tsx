import { useRef, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  Image,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { MobilitySponsor } from "@astra/shared";
import { Text } from "./AppText";
import { Icon } from "./Icon";
import { useT } from "../lib/i18n";
import { videoSupported } from "../lib/video-support";

const Video: typeof import("./RedeemVideo").default | null = videoSupported
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./RedeemVideo").default
  : null;

type Page =
  | { kind: "video"; uri: string; poster: string | null }
  | { kind: "image"; uri: string; caption: string | null };

/** Every page of a sponsor's walkthrough: the video first, then the pictures. */
export function redeemPages(s: MobilitySponsor): Page[] {
  const pages: Page[] = [];
  if (s.redeemVideoUrl) pages.push({ kind: "video", uri: s.redeemVideoUrl, poster: s.redeemVideoPosterUrl });
  for (const sl of s.redeemSlides) if (sl.imageUrl) pages.push({ kind: "image", uri: sl.imageUrl, caption: sl.caption });
  return pages;
}

/**
 * Full-screen "How to redeem" viewer: swipe (or Next / Previous) through a
 * video and pictures. Close is always on screen and Android back closes it, so
 * it can never trap anyone. Mounted only while open, so it always starts on the
 * first page and never keeps a video playing in the background.
 */
export function RedeemViewer({ sponsor, onClose }: { sponsor: MobilitySponsor; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pages = redeemPages(sponsor);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const last = pages.length - 1;

  function go(i: number) {
    const next = Math.max(0, Math.min(last, i));
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  }
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.max(0, Math.min(last, Math.round(e.nativeEvent.contentOffset.x / width))));
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar style="light" />
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}>
        <View className="flex-row items-center gap-2 px-3 py-2">
          <View className="flex-1 pl-2">
            <Text accessibilityRole="header" className="text-base font-semibold text-white" numberOfLines={1}>
              {sponsor.redeemLabel || t("overlays.howToRedeem")}
            </Text>
            {pages.length > 1 ? (
              <Text className="text-xs text-white/70">
                {t("overlays.step", { n: String(index + 1), total: String(pages.length) })}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("overlays.close")}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
          >
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {pages.map((p, i) => (
            <View key={`${p.kind}-${i}`} style={{ width, flex: 1 }}>
              {p.kind === "video" ? (
                Video ? (
                  <Video uri={p.uri} active={index === i} />
                ) : (
                  <View className="flex-1 items-center justify-center px-10">
                    {p.poster ? (
                      <Image
                        source={{ uri: p.poster }}
                        resizeMode="contain"
                        style={{ width: "100%", height: "70%" }}
                        accessibilityIgnoresInvertColors
                      />
                    ) : null}
                    <Text className="mt-4 text-center text-sm text-white/80">{t("overlays.videoUnavailable")}</Text>
                  </View>
                )
              ) : (
                <View className="flex-1">
                  <Image
                    source={{ uri: p.uri }}
                    resizeMode="contain"
                    style={{ flex: 1, width: "100%" }}
                    accessibilityLabel={p.caption ?? undefined}
                    accessibilityIgnoresInvertColors
                  />
                  {p.caption ? (
                    <Text className="px-6 pb-1 pt-3 text-center text-[15px] leading-5 text-white">{p.caption}</Text>
                  ) : null}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {pages.length > 1 ? (
          <View className="flex-row items-center justify-between gap-2 px-4 pt-3">
            <Pressable
              onPress={() => go(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel={t("overlays.previous")}
              accessibilityState={{ disabled: index === 0 }}
              className={`h-11 min-w-[96px] flex-row items-center justify-center gap-1 rounded-full bg-white/15 px-3 ${index === 0 ? "opacity-30" : ""}`}
            >
              <Icon name="chevron-back" size={18} color="#FFFFFF" />
              <Text chrome className="text-sm font-semibold text-white">
                {t("overlays.previous")}
              </Text>
            </Pressable>
            <View className="flex-row gap-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {pages.map((_, i) => (
                <View
                  key={i}
                  className={`h-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/35"}`}
                  style={{ width: i === index ? 16 : 6 }}
                />
              ))}
            </View>
            {index < last ? (
              <Pressable
                onPress={() => go(index + 1)}
                accessibilityRole="button"
                accessibilityLabel={t("overlays.next")}
                className="h-11 min-w-[96px] flex-row items-center justify-center gap-1 rounded-full bg-white px-3"
              >
                <Text chrome className="text-sm font-semibold text-astra-primary">
                  {t("overlays.next")}
                </Text>
                <Icon name="chevron-forward" size={18} color="#04107E" />
              </Pressable>
            ) : (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                className="h-11 min-w-[96px] items-center justify-center rounded-full bg-white px-4"
              >
                <Text chrome className="text-sm font-semibold text-astra-primary">
                  {t("common.done")}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
