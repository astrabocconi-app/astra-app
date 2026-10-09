import { NextResponse } from "next/server";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { signCardToken } from "@/lib/card-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/card/token — a signed token for the authenticated student's card QR.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  // The card earns points at venues; a partner or staff login holding one could
  // farm them at another venue. Students only.
  if (!session.user.roles.includes("STUDENT")) {
    return errorResponse(403, "FORBIDDEN", "Only students have a card.", requestId);
  }
  return NextResponse.json({ token: signCardToken(session.user.id) });
}

export const GET = withApi(handleGet);
