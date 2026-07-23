import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { toRewardItem } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rewards — active catalog for the mobile rewards screen.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const rows = await prisma.reward.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { costPoints: "asc" },
    take: 100,
  });
  return NextResponse.json(
    { items: rows.map(toRewardItem) },
    { headers: { "x-request-id": requestId } },
  );
}
