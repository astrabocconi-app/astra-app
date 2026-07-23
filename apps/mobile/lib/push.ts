import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// Show notifications while the app is foregrounded, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register this device's Expo push token with the server. Best-effort: never
// throws, and no-ops cleanly on the simulator or before an EAS projectId is set.
export async function registerForPush(): Promise<void> {
  try {
    // Push isn't delivered on simulators/emulators.
    if (!Device.isDevice) return;

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId || projectId.includes("REPLACE")) return; // not configured yet

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.push.register(token, Platform.OS === "ios" ? "IOS" : "ANDROID");
  } catch {
    // Best-effort; never block the app on push registration.
  }
}
