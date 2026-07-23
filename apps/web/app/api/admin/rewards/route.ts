import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { rewardInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toRewardItem } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/rewards — full catalog (active + inactive), newest first.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const rows = await prisma.reward.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    { items: rows.map(toRewardItem) },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/rewards — create a reward.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const parsed = rewardInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;
  const created = await prisma.reward.create({
    data: {
      title: d.title,
      description: d.description ?? null,
      imageKey: d.imageUrl ?? null,
      costPoints: d.costPoints,
      stock: d.stock ?? null,
      active: d.active,
    },
  });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "create",
    targetType: "Reward",
    targetId: created.id,
    metadata: { title: created.title, costPoints: created.costPoints },
  });
  return NextResponse.json(toRewardItem(created), { status: 201, headers: { "x-request-id": requestId } });
}
