import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { toEventItem, originFromRequest } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/events — published upcoming events for the mobile list.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  // Show events that haven't ended yet (or have no end): startsAt from ~now on,
  // but keep same-day events visible even if they started earlier today.
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  const rows = await prisma.event.findMany({
    where: { published: true, deletedAt: null, startsAt: { gte: cutoff } },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
  const origin = originFromRequest(req);
  return NextResponse.json(
    { items: rows.map((r) => toEventItem(r, origin)) },
    { headers: { "x-request-id": requestId } },
  );
}
