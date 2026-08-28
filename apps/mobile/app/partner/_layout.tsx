import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import { useT } from "../../lib/i18n";

const BRAND = "#04107E";
const INACTIVE = "#9CA3AF";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type PressableOnPress = ComponentProps<typeof Pressable>["onPress"];

// Raised circular button for the center "Scan" tab — camera icon (mirrors the
// student card button, but for scanning instead of showing a QR).
function CenterScanButton({ onPress }: { onPress?: PressableOnPress }) {
  return (
    <View style={styles.centerWrap} pointerEvents="box-none">
      <Pressable onPress={onPress} style={styles.centerButton} hitSlop={12}>
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
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: INACTIVE,
        headerTitleStyle: { color: BRAND, fontWeight: "700" },
        headerShadowVisible: false,
        // Respect the home-indicator inset so the icons don't hug the bottom edge.
        tabBarStyle: [
          styles.tabBar,
          {
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
        options={{ title: t("partnerTabs.home"), tabBarIcon: tabIcon("stats-chart-outline") }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t("partnerTabs.scan"),
          tabBarLabel: () => null,
          tabBarButton: (props) => <CenterScanButton onPress={props.onPress ?? undefined} />,
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
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
  },
  centerButton: {
    top: -22,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: BRAND,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
