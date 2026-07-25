import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { toNewsItem, originFromRequest } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/news — published posts for the mobile feed (pinned first, newest).
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const rows = await prisma.newsPost.findMany({
    where: { published: true, deletedAt: null },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const origin = originFromRequest(req);
  return NextResponse.json(
    { items: rows.map((r) => toNewsItem(r, origin)) },
    { headers: { "x-request-id": requestId } },
  );
}
