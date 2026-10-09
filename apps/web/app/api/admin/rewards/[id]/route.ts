import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { rewardPatchInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit, changedFields, auditVerb } from "@/lib/audit";
import { toRewardItem } from "@/lib/cms-map";
import { revokeDiscounts } from "@/lib/eventbrite-revoke";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FIELDS = ["title", "description", "imageUrl", "costPoints", "stock", "perUserLimit", "active"] as const;

// PATCH /api/admin/rewards/:id — update (incl. activate/deactivate).
async function handlePatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Reward not found.", requestId);

  const parsed = rewardPatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;

  const next = {
    title: d.title ?? existing.title,
    description: d.description !== undefined ? d.description : existing.description,
    imageUrl: d.imageUrl !== undefined ? d.imageUrl : existing.imageKey,
    costPoints: d.costPoints ?? existing.costPoints,
    stock: d.stock !== undefined ? d.stock : existing.stock,
    perUserLimit: d.perUserLimit !== undefined ? d.perUserLimit : existing.perUserLimit,
    active: d.active ?? existing.active,
  };
  const changes = changedFields({ ...existing, imageUrl: existing.imageKey }, next, FIELDS);
  if (Object.keys(changes).length === 0) {
    return NextResponse.json(toRewardItem(existing));
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.reward.update({
      where: { id },
      data: {
        title: next.title,
        description: next.description,
        imageKey: next.imageUrl,
        costPoints: next.costPoints,
        stock: next.stock ?? null,
        perUserLimit: next.perUserLimit ?? null,
        active: next.active,
      },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: auditVerb(changes, "active"),
        targetType: "Reward",
        targetId: id,
        metadata: { title: row.title, changes },
      },
      tx,
    );
    return row;
  });
  return NextResponse.json(toRewardItem(updated));
}

// DELETE /api/admin/rewards/:id — soft delete. Unused API-generated codes are
// live on Eventbrite, and the reward page 404s afterwards so the pool could never
// be cleaned up by hand: drop them (and revoke them there) in the same step.
async function handleDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Reward not found.", requestId);

  const pending = await prisma.rewardRedemption.count({ where: { rewardId: id, status: "PENDING" } });
  const external = await prisma.$transaction(async (tx) => {
    await tx.reward.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    // One statement, so a code claimed a moment ago is never removed from under its holder.
    const dropped = await tx.$queryRaw<{ externalId: string | null }[]>`
      DELETE FROM "RewardCode" WHERE "rewardId" = ${id} AND "claimedAt" IS NULL RETURNING "externalId"`;
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "delete",
        targetType: "Reward",
        targetId: id,
        metadata: { title: existing.title, codesRemoved: dropped.length, pendingRedemptions: pending },
      },
      tx,
    );
    return dropped.map((r) => r.externalId).filter((x): x is string => x !== null);
  });
  const revocation = await revokeDiscounts(external);
  return NextResponse.json({ ok: true, revoked: revocation.revoked, revokePending: revocation.pending });
}

export const PATCH = withApi(handlePatch);
export const DELETE = withApi(handleDelete);
