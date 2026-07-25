import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { signCardToken } from "@/lib/card-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/card/token — a signed token for the authenticated student's card QR.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  return NextResponse.json(
    { token: signCardToken(session.user.id) },
    { headers: { "x-request-id": requestId } },
  );
}
