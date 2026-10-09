import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse, withApi, log, describeError } from "@/lib/api";
import { processPushReceipts } from "@/lib/push";
import { drainRevocations } from "@/lib/eventbrite-revoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 24 * 3600_000;
/** Each pass is bounded so one run can never turn into an unbounded delete. */
const IMAGE_BATCH = 200;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured: refuse everyone. A cron endpoint that deletes data
  // must never be open because an env var is missing.
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Run one cleanup step; a failure is logged and counted, never allowed to skip the others. */
async function step<T>(requestId: string, name: string, run: () => Promise<T>, out: Record<string, unknown>) {
  try {
    out[name] = await run();
  } catch (e) {
    out[name] = { error: true };
    log("error", requestId, "cron step failed", { step: name, error: describeError(e) });
  }
}

// GET /api/cron/cleanup — daily housekeeping (Vercel cron, `Authorization: Bearer
// $CRON_SECRET`). Idempotent: running it twice removes nothing the first run
// would not have.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  if (!authorised(req)) return errorResponse(401, "UNAUTHORIZED", "Not authorised.", requestId);

  const now = Date.now();
  const counts: Record<string, unknown> = {};

  // Sessions: expired ones, and every session of an account that was deleted.
  // (Better Auth never purges them, and each login mints a new row.)
  await step(requestId, "sessionsExpired", async () =>
    (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } })).count, counts);
  await step(requestId, "sessionsOfDeletedUsers", async () =>
    (await prisma.session.deleteMany({ where: { user: { deletedAt: { not: null } } } })).count, counts);
  // IP and user agent are only useful for a short while after sign-in.
  await step(requestId, "sessionsAnonymised", async () =>
    (
      await prisma.session.updateMany({
        where: {
          createdAt: { lt: new Date(now - 30 * DAY) },
          OR: [{ ipAddress: { not: null } }, { userAgent: { not: null } }],
        },
        data: { ipAddress: null, userAgent: null },
      })
    ).count, counts);

  // Uploaded images nothing points at any more (replaced or removed covers).
  await step(requestId, "imagesPruned", async () => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      DELETE FROM "ImageAsset" WHERE "id" IN (
        SELECT a."id" FROM "ImageAsset" a
        WHERE a."createdAt" < ${new Date(now - 7 * DAY)}
          AND NOT EXISTS (SELECT 1 FROM "Event" e WHERE position('/api/media/' || a."id" in coalesce(e."coverImageKey", '')) > 0)
          AND NOT EXISTS (SELECT 1 FROM "NewsPost" n WHERE position('/api/media/' || a."id" in coalesce(n."coverImageKey", '')) > 0)
          AND NOT EXISTS (SELECT 1 FROM "Reward" r WHERE position('/api/media/' || a."id" in coalesce(r."imageKey", '')) > 0)
          AND NOT EXISTS (SELECT 1 FROM "Partner" p WHERE position('/api/media/' || a."id" in coalesce(p."logoKey", '')) > 0
                                                       OR position('/api/media/' || a."id" in coalesce(p."photoKey", '')) > 0)
          AND NOT EXISTS (SELECT 1 FROM "AppContent" c WHERE position('/api/media/' || a."id" in c."data"::text) > 0)
        LIMIT ${IMAGE_BATCH}
      ) RETURNING "id"`;
    return rows.length;
  }, counts);

  // Push: delivery receipts (drop dead tokens), then throttle bookkeeping.
  await step(requestId, "pushReceipts", () => processPushReceipts(), counts);
  await step(requestId, "eventbriteRevocations", () => drainRevocations(undefined, 100), counts);
  // A discount slot reserved by a request that died before Eventbrite answered.
  await step(requestId, "staleDiscountReservations", async () =>
    (
      await prisma.eventAppDiscount.deleteMany({
        where: { eventbriteDiscountId: "", createdAt: { lt: new Date(now - 10 * 60_000) } },
      })
    ).count, counts);
  await step(requestId, "rateEventsPruned", async () =>
    (await prisma.rateEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 2 * DAY) } } })).count, counts);
  await step(requestId, "rateLimitsPruned", async () =>
    (await prisma.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(now - DAY) } } })).count, counts);
  await step(requestId, "verificationsExpired", async () =>
    (await prisma.verification.deleteMany({ where: { expiresAt: { lt: new Date(now) } } })).count, counts);

  log("info", requestId, "cron cleanup", counts);
  return NextResponse.json({ ok: true, ...counts });
}

export const GET = withApi(handleGet);
