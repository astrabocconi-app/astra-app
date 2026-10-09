import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { rewardInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toRewardItem } from "@/lib/cms-map";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/rewards — full catalog (active + inactive), newest first.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;

  const rows = await prisma.reward.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ items: rows.map((r) => toRewardItem(r)) });
}

// POST /api/admin/rewards — create a reward.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "rewards");
  if ("error" in guard) return guard.error;

  const parsed = rewardInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;
  const created = await prisma.$transaction(async (tx) => {
    const reward = await tx.reward.create({
      data: {
        title: d.title,
        description: d.description,
        imageKey: d.imageUrl ?? null,
        costPoints: d.costPoints,
        stock: d.stock ?? null,
        perUserLimit: d.perUserLimit ?? null,
        active: d.active,
      },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "create",
        targetType: "Reward",
        targetId: reward.id,
        metadata: { title: reward.title, costPoints: reward.costPoints },
      },
      tx,
    );
    return reward;
  });
  return NextResponse.json(toRewardItem(created), { status: 201 });
}

export const GET = withApi(handleGet);
export const POST = withApi(handlePost);
