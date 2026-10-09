import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { toEventItem, originFromRequest } from "@/lib/cms-map";
import { startOfRomeDay } from "@/lib/rome-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/events — published events that haven't ended, for the mobile list.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  // Still on: starts today (Milan's today, not UTC's — UTC midnight is 01:00 or
  // 02:00 in Milan, which dropped late-night events an hour early) or starts
  // later, OR has an end that is still in the future. The second branch keeps a
  // festival or weekend trip visible on day two.
  const now = new Date();
  const rows = await prisma.event.findMany({
    where: {
      published: true,
      deletedAt: null,
      OR: [{ startsAt: { gte: startOfRomeDay(now) } }, { endsAt: { gte: now } }],
    },
    // `id` breaks ties, so events sharing a start time keep their place between refreshes.
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 100,
  });
  const origin = originFromRequest(req);
  return NextResponse.json({ items: rows.map((r) => toEventItem(r, origin)) });
}

export const GET = withApi(handleGet);
