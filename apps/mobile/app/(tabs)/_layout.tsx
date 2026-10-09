import { useEffect, type ComponentProps } from "react";
import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, Image, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../lib/i18n";
import { useEggStore } from "../../lib/egg-store";
import { useSecretTaps } from "../../lib/use-secret-taps";
import { useAuthStore } from "../../lib/auth-store";
import { useBootStore } from "../../lib/boot-store";
import { registerForPush } from "../../lib/push";
import { IMAGES } from "../../lib/assets";
import { AcademicOnboarding } from "../../components/AcademicOnboarding";

const BRAND = "#04107E";
// gray-500: the old gray-400 was 2.5:1 on the white bar, too faint for 11pt labels.
const INACTIVE = "#6B7280";

// Inverted mode is the brand the other way round: white on blue.
const INVERTED_BG = BRAND;
const INVERTED_BAR = "#020A52";
const INVERTED_INACTIVE = "rgba(255,255,255,0.7)";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// Raised circular button for the center "Card" (QR) tab — big + easy to reach.
// The ring takes the bar's colour so it reads as a cut-out in both modes.
// It is a custom tabBarButton, so it must pass on what the navigator hands it:
// without the selected state a screen reader never hears which tab is open.
function CenterCardButton({
  onPress,
  selected,
  ringColor,
  label,
}: {
  onPress?: ComponentProps<typeof Pressable>["onPress"];
  selected: boolean;
  ringColor: string;
  label: string;
}) {
  return (
    <View style={styles.centerWrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={[styles.centerButton, { borderColor: ringColor }]}
        hitSlop={12}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Ionicons
          name="qr-code"
          size={30}
          color="#fff"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>
    </View>
  );
}

/** The navigator reports the open tab as aria-selected (and, on older versions, accessibilityState). */
function isSelected(props: object): boolean {
  const p = props as { "aria-selected"?: boolean; accessibilityState?: { selected?: boolean } | null };
  return Boolean(p["aria-selected"] ?? p.accessibilityState?.selected);
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
  const session = useAuthStore((s) => s.session);
  const booting = useBootStore((s) => s.booting);

  // Push registration waits for the intro to finish, so the permission prompt
  // does not land on top of the animation.
  useEffect(() => {
    if (!booting) void registerForPush();
  }, [booting, session]);

  // Eight taps on the wordmark invert the app.
  const tapLogo = useSecretTaps(8);

  const fg = inverted ? "#FFFFFF" : BRAND;
  const barBg = inverted ? INVERTED_BAR : "#FFFFFF";

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: fg,
          tabBarInactiveTintColor: inverted ? INVERTED_INACTIVE : INACTIVE,
          headerTitleStyle: { color: fg, fontWeight: "600" },
          headerStyle: { backgroundColor: inverted ? INVERTED_BG : "#FFFFFF" },
          headerTintColor: fg,
          headerShadowVisible: false,
          // The bar has a fixed height, so its labels must not outgrow it: iOS
          // already pins them (large-content viewer); Android scaled them and
          // clipped from about 1.3x.
          tabBarAllowFontScaling: false,
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
          tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            // The bar says "Home"/"Home"; the header is the wordmark.
            title: t("tabs.home"),
            headerTitleAlign: "center",
            headerTitle: () => (
              <Pressable
                onPress={() => tapLogo() && toggleInverted()}
                hitSlop={12}
                accessibilityRole="header"
                accessibilityLabel="ASTRA"
              >
                <Image
                  source={inverted ? IMAGES.logoHorizontalWhite : IMAGES.logoHorizontal}
                  resizeMode="contain"
                  style={{ width: 132, height: 34 }}
                  accessibilityIgnoresInvertColors
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
            // The screen renders its own title inside a SafeAreaView.
            headerShown: false,
            tabBarLabel: () => null,
            tabBarButton: (props) => (
              <CenterCardButton
                onPress={props.onPress ?? undefined}
                selected={isSelected(props)}
                ringColor={barBg}
                label={t("tabs.card")}
              />
            ),
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
          options={{ title: t("tabs.academics"), tabBarIcon: tabIcon("school-outline") }}
        />
      </Tabs>
      <AcademicOnboarding key={session} />
    </>
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
    // elevation / shadow
    shadowColor: BRAND,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
