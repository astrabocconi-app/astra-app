import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { listRedemptions } from "@/lib/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me/redemptions — the student's own vouchers and pending claims.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const items = await listRedemptions(session.user.id);
  return NextResponse.json({ items }, { headers: { "x-request-id": requestId } });
}
