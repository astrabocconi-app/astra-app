import { useState } from "react";
import { View, Pressable, Image, Modal, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./AppText";
import { Icon } from "./Icon";
import { ContentLinks } from "./ContentLinks";
import { useHomeBubble } from "../lib/app-content";
import { useT } from "../lib/i18n";

/**
 * The round logo at the bottom right of Home and the card it opens: a picture,
 * a title, some text and buttons, all edited on the backoffice "App overlays"
 * page. Renders nothing when switched off there.
 */
export function HomeBubble() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const content = useHomeBubble();
  const [open, setOpen] = useState(false);
  if (!content?.logoUrl) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={content.title ?? t("overlays.homeBubbleA11y")}
        hitSlop={6}
        style={styles.fab}
        className="bg-white active:opacity-85"
      >
        <Image source={{ uri: content.logoUrl }} resizeMode="cover" style={styles.logo} accessibilityIgnoresInvertColors />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View
          className="flex-1 justify-center px-5"
          style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
          accessibilityViewIsModal
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            className="bg-black/50"
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t("overlays.close")}
          />
          <View className="overflow-hidden rounded-3xl bg-white dark:bg-astra-primary" style={{ maxHeight: height * 0.82 }}>
            <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {content.imageUrl ? (
                <Image
                  source={{ uri: content.imageUrl }}
                  resizeMode="cover"
                  style={{ width: "100%", aspectRatio: 16 / 10 }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View className="items-center pt-7">
                  <Image source={{ uri: content.logoUrl }} resizeMode="cover" style={{ width: 64, height: 64, borderRadius: 32 }} accessibilityIgnoresInvertColors />
                </View>
              )}
              <View className="px-5 pt-5">
                {content.title ? (
                  <Text accessibilityRole="header" className="text-xl font-semibold text-gray-900 dark:text-white">
                    {content.title}
                  </Text>
                ) : null}
                {content.body ? (
                  <Text className="mt-2 text-[15px] leading-6 text-gray-700 dark:text-gray-200">{content.body}</Text>
                ) : null}
                <ContentLinks links={content.links} onOpen={() => setOpen(false)} />
              </View>
            </ScrollView>
            {/* Last, so it sits above the picture and is always reachable. */}
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("overlays.close")}
              className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-black/45"
            >
              <Icon name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  logo: { width: 54, height: 54, borderRadius: 27 },
});
