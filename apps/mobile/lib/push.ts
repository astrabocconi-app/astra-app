import { Platform } from "react-native";
import { IN_APP_ROUTES } from "@astra/shared";
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

// Fire a LOCAL notification — works on the simulator (unlike remote push). For
// demoing how a news alert looks. Returns a short status string for the UI.
export async function sendTestNotification(): Promise<string> {
  try {
    const Notifications = await import("expo-notifications");

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

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "Notifications are turned off — enable them in Settings.";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "ASTRA",
        body: "🔔 New announcement — this is how news alerts will appear.",
        sound: "default",
      },
      trigger: null, // deliver immediately
    });
    return "Sent! Check the banner (background the app to see it on the lock screen too).";
  } catch {
    return "Notifications need a rebuilt dev build to work.";
  }
}

/**
 * Route the app when a notification is tapped.
 *
 * Two cases, and missing either one makes the deep link look broken half the
 * time: a tap while the app is running, and a tap that launched it cold.
 *
 * Native modules stay lazily imported for the same reason as above — a dev
 * client built before expo-notifications existed must not crash on boot.
 */
export async function attachNotificationRouting(
  navigate: (route: string) => void,
): Promise<() => void> {
  try {
    const Notifications = await import("expo-notifications");

    const routeFrom = (response: unknown): string | null => {
      const data = (response as { notification?: { request?: { content?: { data?: unknown } } } })
        ?.notification?.request?.content?.data as { route?: unknown } | undefined;
      const route = typeof data?.route === "string" ? data.route : null;
      // Only ever navigate somewhere we know exists. The payload is ours, but a
      // stale notification could name a screen that has since been removed, and
      // pushing an unknown route throws.
      return route && IN_APP_ROUTES.includes(route as (typeof IN_APP_ROUTES)[number])
        ? route
        : null;
    };

    // Cold start: the notification that opened the app.
    const initial = await Notifications.getLastNotificationResponseAsync();
    const initialRoute = initial ? routeFrom(initial) : null;
    if (initialRoute) navigate(initialRoute);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeFrom(response);
      if (route) navigate(route);
    });
    return () => sub.remove();
  } catch {
    // Notifications unavailable in this build; nothing to attach.
    return () => {};
  }
}
