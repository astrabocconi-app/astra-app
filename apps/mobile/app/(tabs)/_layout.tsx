import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, Image, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Path,
} from "react-native-svg";
import type { ComponentProps } from "react";
import { useT } from "../../lib/i18n";
import { AW } from "../../lib/astraworld-theme";
import { useEggStore } from "../../lib/egg-store";
import { useSecretTaps } from "../../lib/use-secret-taps";

const BRAND = "#04107E";
const INACTIVE = "#9CA3AF";

// Inverted mode is the brand the other way round: white on blue.
const INVERTED_BG = BRAND;
const INVERTED_BAR = "#020A52";
const INVERTED_INACTIVE = "rgba(255,255,255,0.55)";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type PressableOnPress = ComponentProps<typeof Pressable>["onPress"];

/**
 * The ASTRAWORLD tab mark: a filled gradient square in the poster's magenta →
 * green, with a white sparkle. Sits at the same size as the Ionicons around it
 * so the row stays on one baseline. Dims slightly when the tab isn't focused,
 * rather than going grey, so it keeps drawing the eye while the event is on.
 */
function AstraWorldTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={{ opacity: focused ? 1 : 0.75 }}>
      <Svg width={26} height={26} viewBox="0 0 26 26">
        <Defs>
          <SvgLinearGradient id="awTab" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={AW.magenta} />
            <Stop offset="1" stopColor={AW.green} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="26" height="26" rx="8" fill="url(#awTab)" />
        {/* Four-point sparkle, echoing the poster's starburst. */}
        <Path
          d="M13 5.5c.55 3.2 1.8 4.45 5 5s-4.45 1.8-5 5c-.55-3.2-1.8-4.45-5-5s4.45-1.8 5-5z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

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

  // Eight taps on the wordmark invert the app.
  const tapLogo = useSecretTaps(8);

  const fg = inverted ? "#FFFFFF" : BRAND;
  const barBg = inverted ? INVERTED_BAR : "#FFFFFF";

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
      {/* ASTRAWORLD — TEMPORARY, reverts to Academics after 4 September 2026.
          Unlike the other tabs this one is a live event, so it gets the poster's
          gradient mark instead of a plain outline icon: it should read as
          "something is happening", not as another section. Restoring Academics
          means renaming the route back and putting the greyed-out, inert config
          from git history back here. */}
      <Tabs.Screen
        name="astraworld"
        options={{
          title: t("aw.tab"),
          tabBarIcon: ({ focused }) => <AstraWorldTabIcon focused={focused} />,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
          // The vivid magenta is only 3.97:1 on white — fine for the gradient
          // mark, too weak for an 11px label. The label takes the ink variant
          // (6.3:1); in inverted mode the bar is dark, so the vivid one reads.
          tabBarActiveTintColor: inverted ? AW.magenta : AW.magentaInk,
          tabBarInactiveTintColor: inverted ? AW.magenta : AW.magentaInk,
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
