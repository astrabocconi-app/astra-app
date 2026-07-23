import { Platform } from "react-native";
import { api } from "./api";

// Push registration. Native modules (expo-notifications / expo-device) are
// loaded LAZILY inside the try/catch — importing them at the top level would
// crash the whole app on a dev build compiled before they were added
// ("Cannot find native module 'ExpoPushTokenManager'"). This way push simply
// no-ops until the dev client is rebuilt (npx expo run:ios) with the modules
// compiled in — and it never blocks the app from booting.

let handlerSet = false;

export async function registerForPush(): Promise<void> {
  try {
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");
    const Constants = (await import("expo-constants")).default;

    // Show notifications while foregrounded, too (set once).
    if (!handlerSet) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      handlerSet = true;
    }

    // Push isn't delivered on simulators/emulators.
    if (!Device.isDevice) return;

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId;
    if (!projectId || projectId.includes("REPLACE")) return; // not configured yet

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.push.register(token, Platform.OS === "ios" ? "IOS" : "ANDROID");
  } catch {
    // Native module missing (needs a rebuild) or any other issue — no-op.
  }
}
