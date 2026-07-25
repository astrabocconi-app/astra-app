// Expo push notifications. SERVER-ONLY.
//
// Sends via Expo's push service (no SDK — just their HTTP endpoint). Failures
// are swallowed so a push problem never breaks the action that triggered it
// (e.g. publishing a news post still succeeds if Expo is unreachable).

import { prisma } from "@astra/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Send a notification to every registered device. Returns how many were targeted. */
export async function sendPushToAll(payload: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<{ sent: number }> {
  const rows = await prisma.pushToken.findMany({ select: { token: true } });
  const tokens = rows
    .map((r) => r.token)
    .filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"));
  if (tokens.length === 0) return { sent: 0 };

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  for (const batch of chunk(messages, 100)) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(batch),
      });
    } catch {
      // best-effort; ignore transport errors
    }
  }
  return { sent: tokens.length };
}
