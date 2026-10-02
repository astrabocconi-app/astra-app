import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import { useT } from "../../lib/i18n";
import { getPartnerScanOnly } from "../../lib/session";
import { useEggStore } from "../../lib/egg-store";

const BRAND = "#04107E";
const INACTIVE = "#9CA3AF";

// Inverted mode, as in the student tabs: white on blue.
const INVERTED_BAR = "#020A52";
const INVERTED_INACTIVE = "rgba(255,255,255,0.55)";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type PressableOnPress = ComponentProps<typeof Pressable>["onPress"];

// Raised circular button for the center "Scan" tab — camera icon (mirrors the
// student card button, but for scanning instead of showing a QR).
function CenterScanButton({
  onPress,
  ringColor,
  label,
}: {
  onPress?: PressableOnPress;
  ringColor: string;
  label: string;
}) {
  return (
    <View style={styles.centerWrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={[styles.centerButton, { borderColor: ringColor }]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="camera" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size + 2} />
  );
}

export default function PartnerTabsLayout() {
  const insets = useSafeAreaInsets();
  const t = useT();
  // Scan-only logins exist so floor staff can award points without seeing the
  // venue's takings, so the analytics tab is removed entirely rather than
  // shown-and-blocked. /api/partner/stats refuses them server-side too.
  const scanOnly = getPartnerScanOnly();
  const inverted = useEggStore((s) => s.inverted);
  const fg = inverted ? "#FFFFFF" : BRAND;
  const barBg = inverted ? INVERTED_BAR : "#FFFFFF";
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: fg,
        tabBarInactiveTintColor: inverted ? INVERTED_INACTIVE : INACTIVE,
        headerTitleStyle: { color: fg, fontWeight: "600" },
        headerStyle: { backgroundColor: inverted ? BRAND : "#FFFFFF" },
        headerTintColor: fg,
        headerShadowVisible: false,
        // Respect the home-indicator inset so the icons don't hug the bottom edge.
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: barBg,
            borderTopColor: inverted ? "rgba(255,255,255,0.12)" : "#E5E7EB",
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom + 8,
          },
        ],
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("partnerTabs.home"),
          tabBarIcon: tabIcon("stats-chart-outline"),
          href: scanOnly ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t("partnerTabs.scan"),
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <CenterScanButton onPress={props.onPress ?? undefined} ringColor={barBg} label={t("partnerTabs.scan")} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("partnerTabs.profile"), tabBarIcon: tabIcon("person-outline") }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 8,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
  },
  centerButton: {
    top: -16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    shadowColor: BRAND,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
