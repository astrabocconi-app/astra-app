import { NextResponse } from "next/server";
import { pointsHistoryResponse } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getHistory } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/points/history — the authenticated user's recent ledger entries.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  const rows = await getHistory(session.user.id);
  const body = pointsHistoryResponse.parse({
    entries: rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      source: r.source,
      reason: r.reason,
      refType: r.refType,
      refId: r.refId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
  return NextResponse.json(body, { headers: { "x-request-id": requestId } });
}
