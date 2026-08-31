import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import {
  createDiscount,
  deleteDiscount,
  generateCode,
  isEventbriteConfigured,
  DuplicateCodeError,
} from "@/lib/eventbrite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Each code is a separate Eventbrite API call, so a batch is bounded to keep the
 * request inside the function timeout. Generating more is just running it again.
 */
const MAX_BATCH = 20;
/** A few at a time: fast enough, well inside Eventbrite's rate limit. */
const CONCURRENCY = 4;
/** Random codes collide vanishingly rarely, but handle it rather than fail. */
const DUPLICATE_RETRIES = 3;

const input = z.object({
  eventId: z.string().min(1, "Pick an event"),
  percentOff: z.number().int().min(1).max(100),
  quantity: z.number().int().min(1).max(MAX_BATCH),
});

interface Made {
  discountId: string;
  code: string;
}

// POST /api/admin/rewards/:id/codes/eventbrite
// Create single-use discounts on Eventbrite and add them to the reward's pool.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  if (!isEventbriteConfigured()) {
    return errorResponse(
      503,
      "NOT_CONFIGURED",
      "Eventbrite isn't connected. Add EVENTBRITE_PRIVATE_TOKEN and EVENTBRITE_ORG_ID.",
      requestId,
    );
  }

  const reward = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!reward) return errorResponse(404, "NOT_FOUND", "Reward not found.", requestId);

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid input.",
      requestId,
    );
  }
  const { eventId, percentOff, quantity } = parsed.data;

  // Codes already in this reward's pool, so a regenerate can't reuse one.
  const existing = new Set(
    (
      await prisma.rewardCode.findMany({ where: { rewardId: id }, select: { code: true } })
    ).map((r) => r.code),
  );

  const made: Made[] = [];
  const failures: string[] = [];

  // Reserve every code up front so concurrent workers can't pick the same one.
  const planned: string[] = [];
  while (planned.length < quantity) {
    const code = generateCode();
    if (existing.has(code)) continue;
    existing.add(code);
    planned.push(code);
  }

  async function makeOne(initial: string): Promise<void> {
    let code = initial;
    for (let attempt = 0; attempt <= DUPLICATE_RETRIES; attempt++) {
      try {
        const res = await createDiscount({ eventId, code, percentOff });
        made.push({ discountId: res.id, code: res.code });
        return;
      } catch (e) {
        // The code exists on Eventbrite already (perhaps from another reward) —
        // take a fresh one and try again.
        if (e instanceof DuplicateCodeError && attempt < DUPLICATE_RETRIES) {
          do {
            code = generateCode();
          } while (existing.has(code));
          existing.add(code);
          continue;
        }
        failures.push(e instanceof Error ? e.message : "Unknown error");
        return;
      }
    }
  }

  // Simple worker pool over the planned codes.
  const queue = [...planned];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const next = queue.shift();
        if (next === undefined) return;
        await makeOne(next);
      }
    }),
  );

  if (made.length === 0) {
    return errorResponse(
      502,
      "EVENTBRITE_ERROR",
      failures[0] ?? "Eventbrite didn't create any codes.",
      requestId,
    );
  }

  // The discounts are live on Eventbrite now, so the pool rows must land. If
  // they can't, revoke what we just created rather than leave codes that exist
  // on Eventbrite but that ASTRA can never hand out.
  let added: number;
  try {
    const result = await prisma.rewardCode.createMany({
      data: made.map((m) => ({
        rewardId: id,
        code: m.code,
        externalId: m.discountId,
        externalEventId: eventId,
      })),
      skipDuplicates: true,
    });
    added = result.count;
  } catch {
    await Promise.all(made.map((m) => deleteDiscount(m.discountId)));
    return errorResponse(
      500,
      "SAVE_FAILED",
      "Couldn't save the codes, so the discounts were revoked on Eventbrite. Nothing was left dangling — try again.",
      requestId,
    );
  }

  await writeAudit({
    actorId: guard.session.user.id,
    action: "update",
    targetType: "RewardCode",
    targetId: id,
    metadata: {
      title: reward.title,
      source: "eventbrite",
      eventId,
      percentOff,
      requested: quantity,
      added,
      failed: failures.length,
    },
  });

  return NextResponse.json(
    {
      added,
      requested: quantity,
      failed: failures.length,
      // Surfaced so a partial batch says why, instead of a silent short count.
      firstError: failures[0] ?? null,
    },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}
