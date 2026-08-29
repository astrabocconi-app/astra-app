import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, Image, type ColorValue } from "react-native";
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
          // Rendered by the navigator like every other tab so the icon and
          // label sit on exactly the same baseline — a hand-rolled button was
          // always a pixel or two out. Greyed out, with the "Soon!" ribbon as
          // a badge, and inert via the tabPress listener below.
          tabBarIcon: ({ size }) => (
            <Ionicons name="school-outline" size={size} color={DISABLED} />
          ),
          tabBarLabelStyle: { fontSize: 11, color: DISABLED },
          tabBarBadge: t("academics.soonFlag"),
          tabBarBadgeStyle: styles.soonBadge,
        }}
        listeners={{
          // Visible but not yet navigable.
          tabPress: (e) => e.preventDefault(),
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
  soonBadge: {
    backgroundColor: "#FFCC00", // brand gold, against the brand blue text
    color: BRAND,
    fontSize: 9,
    fontWeight: "800",
    // The badge is built for short counts and clips a word to "So…", so it
    // needs an explicit width and its own radius rather than the derived one.
    lineHeight: 15,
    height: 15,
    minWidth: 38,
    borderRadius: 8,
    paddingHorizontal: 5,
    overflow: "hidden",
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
