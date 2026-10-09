import { NextResponse } from "next/server";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { listRedemptions } from "@/lib/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me/redemptions — the student's own vouchers and pending claims,
// newest first. Pages with ?cursor=<nextCursor>; the first page is the latest 50.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const params = new URL(req.url).searchParams;
  const { items, nextCursor } = await listRedemptions(session.user.id, {
    limit: Number(params.get("limit") ?? "") || undefined,
    cursor: params.get("cursor"),
  });
  return NextResponse.json({ items, nextCursor });
}

export const GET = withApi(handleGet);
