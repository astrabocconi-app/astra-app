import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, Image, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import { useT } from "../../lib/i18n";
import { useEggStore } from "../../lib/egg-store";
import { useSecretTaps } from "../../lib/use-secret-taps";

const BRAND = "#04107E";
const INACTIVE = "#9CA3AF";
const DISABLED = "#C4C8D4";

// Inverted mode is the brand the other way round: white on blue.
const INVERTED_BG = BRAND;
const INVERTED_BAR = "#020A52";
const INVERTED_INACTIVE = "rgba(255,255,255,0.55)";
const INVERTED_DISABLED = "rgba(255,255,255,0.3)";

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
  const inverted = useEggStore((s) => s.inverted);
  const toggleInverted = useEggStore((s) => s.toggleInverted);

  // Two hidden gestures, both on this bar: eight taps on the wordmark invert
  // the app, ten on the greyed-out Academics tab open it anyway.
  const tapLogo = useSecretTaps(8);
  const tapAcademics = useSecretTaps(10);

  const fg = inverted ? "#FFFFFF" : BRAND;
  const barBg = inverted ? INVERTED_BAR : "#FFFFFF";
  const disabled = inverted ? INVERTED_DISABLED : DISABLED;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: fg,
        tabBarInactiveTintColor: inverted ? INVERTED_INACTIVE : INACTIVE,
        headerTitleStyle: { color: fg, fontWeight: "700" },
        headerStyle: { backgroundColor: inverted ? INVERTED_BG : "#FFFFFF" },
        headerTintColor: fg,
        headerShadowVisible: false,
        // Respect the home-indicator inset so the icons don't hug the bottom
        // edge, and inset the bar horizontally so the outer tabs don't touch the
        // screen sides.
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: barBg,
            borderTopColor: inverted ? "rgba(255,255,255,0.12)" : "#E5E7EB",
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
            <Pressable onPress={() => tapLogo() && toggleInverted()} hitSlop={12}>
              <Image
                // Metro resolves bundled image assets through CommonJS.
                source={
                  inverted
                    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
                      require("../../assets/logo-horizontal-white.png")
                    : // eslint-disable-next-line @typescript-eslint/no-require-imports
                      require("../../assets/logo-horizontal.png")
                }
                resizeMode="contain"
                style={{ width: 132, height: 34 }}
              />
            </Pressable>
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
            <Ionicons name="school-outline" size={size} color={disabled} />
          ),
          tabBarLabelStyle: { fontSize: 11, color: disabled },
          tabBarBadge: t("academics.soonFlag"),
          tabBarBadgeStyle: styles.soonBadge,
        }}
        listeners={{
          // Visible but not yet navigable — except to whoever taps it ten times.
          // Let the tenth tap through and the navigator does the rest.
          tabPress: (e) => {
            if (!tapAcademics()) e.preventDefault();
          },
        }}
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
