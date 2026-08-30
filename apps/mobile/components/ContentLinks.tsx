import { View, Text, Pressable, Linking, Alert } from "react-native";
import { router } from "expo-router";
import type { ContentLink } from "@astra/shared";
import { Icon } from "./Icon";
import { useT } from "../lib/i18n";

/**
 * The call-to-action links at the bottom of a news post or an event.
 *
 * Two kinds, and the difference is visible: an external link opens the browser
 * and says so with an outbound arrow, an internal one jumps to another screen
 * and gets a chevron. Without that, a button that yanks you out to Safari feels
 * like a mis-tap.
 */
export function ContentLinks({ links }: { links: ContentLink[] }) {
  const t = useT();
  if (!links || links.length === 0) return null;

  async function open(link: ContentLink) {
    if (link.kind === "internal") {
      // Routes come from a server-side allowlist, so this is a known screen.
      router.push(link.value as never);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(link.value);
      if (!supported) throw new Error("unsupported");
      await Linking.openURL(link.value);
    } catch {
      Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody"));
    }
  }

  return (
    <View className="mt-6 gap-2">
      {links.map((link, i) => (
        <Pressable
          key={`${link.kind}-${link.value}-${i}`}
          onPress={() => open(link)}
          accessibilityRole="link"
          className="flex-row items-center gap-2.5 rounded-2xl border border-astra-primary/20 bg-astra-light dark:bg-white/10 px-4 py-3.5 active:opacity-80"
        >
          <Text
            className="flex-1 text-[15px] font-semibold text-astra-primary dark:text-white"
            numberOfLines={2}
          >
            {link.label}
          </Text>
          <Icon
            name={link.kind === "external" ? "open-outline" : "chevron-forward"}
            size={18}
            color="#04107E"
          />
        </Pressable>
      ))}
    </View>
  );
}
