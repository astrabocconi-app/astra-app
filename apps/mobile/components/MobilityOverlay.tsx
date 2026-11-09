import { useState } from "react";
import { View, Pressable, Image, Modal, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { MapSponsorsContent } from "@astra/shared";
import { Text } from "./AppText";
import { Icon } from "./Icon";
import { useT } from "../lib/i18n";
import { useEggStore } from "../lib/egg-store";

const BRAND = "#04107E";

function Logo({ uri, size }: { uri: string | null; size: number }) {
  const inverted = useEggStore((s) => s.inverted);
  return uri ? (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#fff" }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className="items-center justify-center bg-astra-light dark:bg-white/10">
      <Icon name="bicycle" size={size * 0.5} color={inverted ? "#FFFFFF" : BRAND} />
    </View>
  );
}

/**
 * The "Wanna get there fast?" speech bubble at the bottom right of the map, and
 * the sheet it opens: one row per mobility sponsor, each leading to its page.
 * Everything here is edited on the backoffice "App overlays" page.
 */
export function MobilityOverlay({ content }: { content: MapSponsorsContent }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const logos = content.sponsors.slice(0, 3);

  function choose(id: string) {
    setOpen(false);
    router.push(`/sponsor/${encodeURIComponent(id)}`);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${content.bubbleText}. ${t("overlays.mapBubbleA11y")}`}
        style={styles.bubbleWrap}
        hitSlop={6}
        className="active:opacity-90"
      >
        <View style={styles.bubble} className="bg-white dark:bg-astra-dark">
          <View className="flex-row" style={{ marginRight: 2 }}>
            {logos.map((s, i) => (
              <View key={s.id} style={{ marginLeft: i === 0 ? 0 : -10, borderRadius: 14, borderWidth: 2, borderColor: "#fff" }}>
                <Logo uri={s.logoUrl} size={24} />
              </View>
            ))}
          </View>
          <Text chrome maxFontSizeMultiplier={1.2} className="text-[13px] font-semibold text-astra-primary dark:text-white" numberOfLines={1}>
            {content.bubbleText}
          </Text>
        </View>
        {/* The speech-bubble tail, pointing down-right at the corner. */}
        <View style={styles.tail} className="bg-white dark:bg-astra-dark" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end" accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            className="bg-black/40"
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t("overlays.close")}
          />
          <View className="rounded-t-3xl bg-white dark:bg-astra-primary pt-2" style={{ maxHeight: "80%", paddingBottom: insets.bottom + 12 }}>
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-gray-300 dark:bg-white/30" />
            <View className="flex-row items-start gap-2 px-5 pb-2">
              <View className="flex-1">
                <Text accessibilityRole="header" className="text-xl font-semibold text-gray-900 dark:text-white">
                  {content.title || content.bubbleText || t("overlays.chooseTitle")}
                </Text>
                <Text className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{content.subtitle || t("overlays.chooseSub")}</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("overlays.close")}
                className="-mr-2 h-11 w-11 items-center justify-center"
              >
                <Icon name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
              {content.sponsors.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => choose(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={[s.name, s.tagline].filter(Boolean).join(", ")}
                  className="min-h-[72px] flex-row items-center gap-3.5 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 active:bg-astra-light dark:active:bg-white/10"
                >
                  <Logo uri={s.logoUrl} size={48} />
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s.tagline ? (
                      <Text className="mt-0.5 text-[13px] text-gray-600 dark:text-gray-300" numberOfLines={2}>
                        {s.tagline}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: { position: "absolute", right: 14, bottom: 22, alignItems: "flex-end", maxWidth: "78%" },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  tail: {
    width: 14,
    height: 14,
    marginTop: -8,
    marginRight: 16,
    transform: [{ rotate: "45deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
    elevation: 5,
  },
});
