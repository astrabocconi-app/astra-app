import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, Image, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import { useT } from "../../lib/i18n";
import { AW } from "../../lib/astraworld-theme";
import { AstraMark } from "../../components/AstraMark";
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
 * The ASTRAWORLD tab mark: the ASTRA monogram itself, tinted to the event's
 * magenta so it still reads as "this one is different" next to the grey outline
 * icons. Dims slightly when unfocused rather than going grey, so it keeps
 * drawing the eye while the event is on.
 */
function AstraWorldTabIcon({ focused, color }: { focused: boolean; color: string }) {
  return (
    <View style={{ opacity: focused ? 1 : 0.8 }}>
      <AstraMark size={25} color={color} />
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
          Unlike the other tabs this one is a live event, so it carries the ASTRA
          monogram in the event's magenta rather than a grey outline glyph: it
          should read as "something is happening", not as another section.
          Restoring Academics means renaming the route back and putting the
          greyed-out, inert config from git history back here. */}
      <Tabs.Screen
        name="astraworld"
        options={{
          title: t("aw.tab"),
          // Colour the mark and the label directly rather than via
          // tabBarActive/InactiveTintColor: those are read from whichever screen
          // is focused and repaint the WHOLE bar, which turned every other tab
          // magenta the moment this one was open.
          //
          // The vivid magenta is only 3.97:1 on white — fine for a glyph, too
          // weak for an 11px label — so the label takes the ink variant (6.3:1).
          // In inverted mode the bar is dark, so the vivid one reads there.
          tabBarIcon: ({ focused }) => (
            <AstraWorldTabIcon focused={focused} color={inverted ? AW.magenta : AW.magentaInk} />
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            color: inverted ? AW.magenta : AW.magentaInk,
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
