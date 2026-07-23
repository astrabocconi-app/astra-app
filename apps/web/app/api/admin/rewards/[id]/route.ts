import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { rewardInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toRewardItem } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/rewards/:id — update (incl. activate/deactivate).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Reward not found.", requestId);

  const parsed = rewardInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;
  const updated = await prisma.reward.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      ...(d.imageUrl !== undefined ? { imageKey: d.imageUrl ?? null } : {}),
      ...(d.costPoints !== undefined ? { costPoints: d.costPoints } : {}),
      ...(d.stock !== undefined ? { stock: d.stock ?? null } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
    },
  });
  await writeAudit({
    actorId: guard.session.user.id,
    action: d.active === undefined ? "update" : d.active ? "publish" : "unpublish",
    targetType: "Reward",
    targetId: id,
    metadata: { title: updated.title },
  });
  return NextResponse.json(toRewardItem(updated), { headers: { "x-request-id": requestId } });
}

// DELETE /api/admin/rewards/:id — soft delete.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Reward not found.", requestId);

  await prisma.reward.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "delete",
    targetType: "Reward",
    targetId: id,
    metadata: { title: existing.title },
  });
  return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
}
