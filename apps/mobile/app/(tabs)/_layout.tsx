import { Tabs, router } from "expo-router";
import { View, Text, Pressable, StyleSheet, Image, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import { useT } from "../../lib/i18n";

const BRAND = "#04107E";
const INACTIVE = "#9CA3AF";
const DISABLED = "#C4C8D4";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type PressableOnPress = ComponentProps<typeof Pressable>["onPress"];

// Raised circular button for the center "Card" (QR) tab — big + easy to reach.
function CenterCardButton({ onPress }: { onPress?: PressableOnPress }) {
  return (
    <View style={styles.centerWrap} pointerEvents="box-none">
      <Pressable onPress={onPress} style={styles.centerButton} hitSlop={12}>
        <Ionicons name="qr-code" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
}

/**
 * A tab that's visible but inert, flagged with a small "Soon!" ribbon.
 *
 * Rendered as a plain View rather than a disabled Pressable so there's no
 * press feedback at all — tapping it should feel like nothing is there yet,
 * not like a broken button.
 */
function ComingSoonTab({ label, flag }: { label: string; flag: string }) {
  return (
    <View style={styles.soonWrap} pointerEvents="none">
      <View>
        <Ionicons name="school-outline" size={26} color={DISABLED} />
        <View style={styles.soonFlag}>
          <Text style={styles.soonFlagText}>{flag}</Text>
        </View>
      </View>
      <Text style={styles.soonLabel}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: INACTIVE,
        headerTitleStyle: { color: BRAND, fontWeight: "700" },
        headerShadowVisible: false,
        // Respect the home-indicator inset so the icons don't hug the bottom
        // edge, and inset the bar horizontally so the outer tabs don't touch the
        // screen sides.
        tabBarStyle: [
          styles.tabBar,
          {
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingHorizontal: 16,
          },
        ],
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          // Centered ASTRA wordmark instead of a "Home" title.
          headerTitleAlign: "center",
          headerTitle: () => (
            <Image
              // Metro resolves bundled image assets through CommonJS.
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/logo-horizontal.png")}
              resizeMode="contain"
              style={{ width: 132, height: 34 }}
            />
          ),
          tabBarIcon: tabIcon("home-outline"),
          // Profile moved off the tab bar to make room for Academics; it lives
          // here, where a profile avatar is conventionally found.
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/profile")}
              hitSlop={10}
              className="mr-4 h-9 w-9 items-center justify-center rounded-full bg-astra-light active:opacity-70"
              accessibilityLabel={t("tabs.profile")}
            >
              <Ionicons name="person" size={19} color={BRAND} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="events" options={{ title: t("tabs.events"), tabBarIcon: tabIcon("calendar-outline") }} />
      <Tabs.Screen
        name="card"
        options={{
          title: t("tabs.card"),
          tabBarLabel: () => null,
          tabBarButton: (props) => <CenterCardButton onPress={props.onPress ?? undefined} />,
        }}
      />
      <Tabs.Screen
        name="discounts"
        options={{
          title: t("tabs.discounts"),
          tabBarIcon: tabIcon("pricetags-outline"),
          // The screen renders its own title + segmented switch.
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="academics"
        options={{
          title: t("tabs.academics"),
          // Inert until the section exists: swapping the button for a plain
          // view means no navigation and no press feedback.
          tabBarButton: () => (
            <ComingSoonTab label={t("tabs.academics")} flag={t("academics.soonFlag")} />
          ),
        }}
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
  soonWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    gap: 2,
  },
  soonFlag: {
    position: "absolute",
    top: -7,
    left: 15,
    backgroundColor: "#FFCC00",
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  soonFlagText: {
    fontSize: 8,
    fontWeight: "800",
    color: BRAND,
  },
  soonLabel: {
    fontSize: 11,
    color: DISABLED,
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
    // elevation / shadow
    shadowColor: BRAND,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
