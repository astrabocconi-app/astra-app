import { prisma } from "@astra/db";
import { newRequestId, errorResponse, withApi, cachedJson } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { toPolarePost, originFromRequest } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/polare — the Stella Polare feed (pinned first, then newest).
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const rows = await prisma.polarePost.findMany({
    where: { published: true, deletedAt: null },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const origin = originFromRequest(req);
  return cachedJson(req, { items: rows.map((r) => toPolarePost(r, origin)) }, 30);
}

export const GET = withApi(handleGet);
