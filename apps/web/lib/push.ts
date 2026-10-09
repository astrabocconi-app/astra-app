// Expo push notifications. SERVER-ONLY.
//
// Sends via Expo's push service (no SDK — just their HTTP endpoint). Every call
// is time-boxed; a push problem is reported to the caller, never thrown past it.
//
// Dead devices: Expo reports an uninstalled app (DeviceNotRegistered) either on
// the ticket straight away or, more often, later in the delivery receipt. Both
// paths delete the token, so we stop sending to (and being penalised for) it.

import { prisma } from "@astra/db";
import { upstreamFetch, newRequestId, log, describeError } from "./api";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const TIMEOUT_MS = 10_000;
const BATCH = 100;
/** Batches in flight at once: 100 000 devices would otherwise be 1 000 sequential calls. */
const CONCURRENCY = 3;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface ExpoTicket {
  status: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Send to an explicit list of tokens, reporting what actually happened.
 *
 * Here the send IS the action: someone pressed "Send" and is owed the truth
 * about whether it went, so failures are counted and sampled rather than hidden.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<{ accepted: number; failed: number; errors: string[]; pruned: number }> {
  if (tokens.length === 0) return { accepted: 0, failed: 0, errors: [], pruned: 0 };

  let accepted = 0;
  let failed = 0;
  const errors: string[] = [];
  const dead: string[] = [];
  const receipts: { id: string; token: string }[] = [];

  const queue = chunk(tokens, BATCH);
  async function worker() {
    for (;;) {
      const batch = queue.shift();
      if (!batch) return;
      const messages = batch.map((to) => ({
        to,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      }));
      try {
        const res = await upstreamFetch("expo-push", EXPO_PUSH_URL, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(messages),
          timeoutMs: TIMEOUT_MS,
        });
        const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
        if (!res.ok || !json?.data) {
          failed += batch.length;
          errors.push(`Expo returned ${res.status}`);
          continue;
        }
        json.data.forEach((ticket, i) => {
          const token = batch[i]!;
          if (ticket.status === "ok") {
            accepted += 1;
            if (ticket.id) receipts.push({ id: ticket.id, token });
          } else {
            failed += 1;
            if (ticket.details?.error === "DeviceNotRegistered") dead.push(token);
            // A couple of samples rather than one line per dead device.
            if (errors.length < 5 && ticket.message) errors.push(ticket.message);
          }
        });
      } catch (e) {
        failed += batch.length;
        errors.push(e instanceof Error && e.name === "TimeoutError" ? "Expo timed out" : "Could not reach Expo");
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  let pruned = 0;
  if (dead.length > 0) pruned = (await prisma.pushToken.deleteMany({ where: { token: { in: dead } } })).count;
  if (receipts.length > 0) {
    // Receipts say whether the push really reached the device; the cron reads them later.
    await prisma.pushReceipt
      .createMany({ data: receipts, skipDuplicates: true })
      .catch((e) => log("warn", newRequestId(), "could not store push receipts", { error: describeError(e) }));
  }
  return { accepted, failed, errors, pruned };
}

/**
 * Read the delivery receipts for tickets old enough to have settled (Expo asks
 * for 15 minutes), drop tokens reported dead, and forget the tickets. Receipts
 * expire after 24 hours on Expo's side, so anything older is just discarded.
 */
export async function processPushReceipts(limit = 1000): Promise<{ checked: number; pruned: number; discarded: number }> {
  const requestId = newRequestId();
  const settled = new Date(Date.now() - 15 * 60_000);
  const expired = new Date(Date.now() - 24 * 3600_000);

  const discarded = (await prisma.pushReceipt.deleteMany({ where: { createdAt: { lt: expired } } })).count;
  const rows = await prisma.pushReceipt.findMany({
    where: { createdAt: { lt: settled } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let pruned = 0;
  let checked = 0;
  for (const batch of chunk(rows, 300)) {
    try {
      const res = await upstreamFetch("expo-receipts", EXPO_RECEIPTS_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ids: batch.map((r) => r.id) }),
        timeoutMs: TIMEOUT_MS,
      });
      const json = (await res.json().catch(() => null)) as { data?: Record<string, ExpoTicket> } | null;
      if (!res.ok || !json?.data) continue;
      const answered = batch.filter((r) => json.data![r.id]);
      const dead = answered
        .filter((r) => json.data![r.id]!.details?.error === "DeviceNotRegistered")
        .map((r) => r.token);
      if (dead.length > 0) pruned += (await prisma.pushToken.deleteMany({ where: { token: { in: dead } } })).count;
      await prisma.pushReceipt.deleteMany({ where: { id: { in: answered.map((r) => r.id) } } });
      checked += answered.length;
    } catch (e) {
      log("warn", requestId, "push receipts batch failed", { error: describeError(e) });
    }
  }
  return { checked, pruned, discarded };
}
