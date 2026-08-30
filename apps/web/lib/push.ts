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

/**
 * Send to an explicit list of tokens, reporting what actually happened.
 *
 * Unlike sendPushToAll, this does NOT swallow errors. That function is fired as
 * a side effect of publishing a news post, where a push failure must not fail
 * the publish. Here the send IS the action: someone pressed "Send" and is owed
 * the truth about whether it went.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<{ accepted: number; failed: number; errors: string[] }> {
  if (tokens.length === 0) return { accepted: 0, failed: 0, errors: [] };

  let accepted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const batch of chunk(tokens, 100)) {
    const messages = batch.map((to) => ({
      to,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const json = (await res.json().catch(() => null)) as
        | { data?: { status: string; message?: string }[] }
        | null;
      if (!res.ok || !json?.data) {
        failed += batch.length;
        errors.push(`Expo returned ${res.status}`);
        continue;
      }
      for (const ticket of json.data) {
        if (ticket.status === "ok") accepted += 1;
        else {
          failed += 1;
          // Expo reports per-message problems (most often DeviceNotRegistered,
          // i.e. the app was uninstalled). Keep a couple as a sample rather
          // than one line per dead device.
          if (errors.length < 5 && ticket.message) errors.push(ticket.message);
        }
      }
    } catch (e) {
      failed += batch.length;
      errors.push(e instanceof Error ? e.message : "Could not reach Expo");
    }
  }
  return { accepted, failed, errors };
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
