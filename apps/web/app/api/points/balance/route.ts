import { NextResponse } from "next/server";
import { pointsBalanceResponse } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getBalance } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/points/balance — the authenticated user's spendable balance.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  const balance = await getBalance(session.user.id);
  const body = pointsBalanceResponse.parse({ balance, kind: "POINTS" });
  return NextResponse.json(body, { headers: { "x-request-id": requestId } });
}
