import { NextResponse } from "next/server";
import { pointsHistoryResponse } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getHistory } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/points/history — the authenticated user's ledger entries, newest
// first. `?limit=` (max 100) and `?cursor=<nextCursor>` page further back; the
// default (the latest 50, plus a `nextCursor` field older apps ignore) is what
// builds before paging existed expect.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  const params = new URL(req.url).searchParams;
  const limit = Number(params.get("limit") ?? "") || undefined;
  const { entries, nextCursor } = await getHistory(session.user.id, {
    limit,
    cursor: params.get("cursor"),
  });
  const body = pointsHistoryResponse.parse({
    entries: entries.map((r) => ({
      id: r.id,
      delta: r.delta,
      source: r.source,
      reason: r.reason,
      refType: r.refType,
      refId: r.refId,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  });
  return NextResponse.json(body);
}

export const GET = withApi(handleGet);
