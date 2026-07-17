import { Tabs } from "expo-router";
import { View, Pressable, StyleSheet, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

const BRAND = "#04107E";
const INACTIVE = "#9CA3AF";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// Raised circular button for the center "Card" (QR) tab — big + easy to reach.
function CenterCardButton({ onPress }: { onPress?: (e: any) => void }) {
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
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: INACTIVE,
        headerTitleStyle: { color: BRAND, fontWeight: "700" },
        headerShadowVisible: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="events" options={{ title: "Events", tabBarIcon: tabIcon("calendar-outline") }} />
      <Tabs.Screen
        name="card"
        options={{
          title: "Card",
          tabBarLabel: () => null,
          tabBarButton: (props) => <CenterCardButton onPress={props.onPress ?? undefined} />,
        }}
      />
      <Tabs.Screen name="rewards" options={{ title: "Rewards", tabBarIcon: tabIcon("gift-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("person-outline") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    paddingTop: 6,
    borderTopColor: "#E5E7EB",
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
