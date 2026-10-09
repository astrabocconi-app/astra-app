import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { revokeDiscounts } from "@/lib/eventbrite-revoke";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const input = z.object({
  // Pasted straight from Eventbrite — one code per line.
  codes: z.string().min(1, "Paste at least one code").max(200_000),
});

/** A pasted list is capped so one request cannot insert an unbounded batch. */
const MAX_CODES = 2000;

// GET /api/admin/rewards/:id/codes — pool status and the unclaimed codes.
async function handleGet(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const rows = await prisma.rewardCode.findMany({
    where: { rewardId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, claimedAt: true },
  });
  return NextResponse.json({
    total: rows.length,
    available: rows.filter((r) => r.claimedAt === null).length,
    codes: rows.map((r) => ({ ...r, claimedAt: r.claimedAt?.toISOString() ?? null })),
  });
}

// POST /api/admin/rewards/:id/codes — add vouchers to the pool.
async function handlePost(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const reward = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!reward) return errorResponse(404, "NOT_FOUND", "Reward not found.", requestId);

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }

  const codes = [
    ...new Set(
      parsed.data.codes
        .split(/[\r\n,;]+/)
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  if (codes.length === 0) {
    return errorResponse(400, "BAD_REQUEST", "No usable codes found.", requestId);
  }
  if (codes.length > MAX_CODES) {
    return errorResponse(400, "BAD_REQUEST", `Add at most ${MAX_CODES} codes at a time.`, requestId);
  }

  // skipDuplicates so re-pasting a list that overlaps an earlier upload adds
  // only what's new rather than failing the whole batch.
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.rewardCode.createMany({
      data: codes.map((code) => ({ rewardId: id, code })),
      skipDuplicates: true,
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "update",
        targetType: "RewardCode",
        targetId: id,
        metadata: { title: reward.title, added: created.count, submitted: codes.length },
      },
      tx,
    );
    return created;
  });

  return NextResponse.json(
    { added: result.count, skipped: codes.length - result.count },
    { status: 201 },
  );
}

// DELETE /api/admin/rewards/:id/codes — drop every UNCLAIMED code.
async function handleDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  // Claimed codes are never removed — a student is holding them. The delete and
  // the read of what was deleted are ONE statement: reading first and deleting
  // after let a code claimed in between be revoked on Eventbrite while its holder
  // still had it.
  const { removed, external } = await prisma.$transaction(async (tx) => {
    const dropped = await tx.$queryRaw<{ externalId: string | null }[]>`
      DELETE FROM "RewardCode" WHERE "rewardId" = ${id} AND "claimedAt" IS NULL RETURNING "externalId"`;
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "update",
        targetType: "RewardCode",
        targetId: id,
        metadata: { removed: dropped.length },
      },
      tx,
    );
    return {
      removed: dropped.length,
      external: dropped.map((r) => r.externalId).filter((x): x is string => x !== null),
    };
  });

  // Codes generated through the API exist on Eventbrite too. Dropping our row
  // without revoking there would leave a live, redeemable discount that ASTRA
  // no longer tracks. Bounded concurrency, time-boxed per call, and anything
  // Eventbrite does not confirm is queued for the daily cron.
  const { revoked, pending } = await revokeDiscounts(external);
  return NextResponse.json({ removed, revoked, revokeFailed: pending });
}

export const GET = withApi(handleGet);
export const POST = withApi(handlePost);
export const DELETE = withApi(handleDelete);
