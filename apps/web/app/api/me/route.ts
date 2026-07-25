import { NextResponse } from "next/server";
import { meResponse } from "@astra/shared";
import { newRequestId, errorResponse, log } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me — the authenticated student's profile.
// Resolves the Better Auth session (cookie or Bearer token), loads the User,
// and returns only the fields in MeResponse (@astra/shared).
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }

  const body = meResponse.parse({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roles: session.user.roles,
  });
  log("info", requestId, "GET /api/me", { userId: session.user.id });
  return NextResponse.json(body, { headers: { "x-request-id": requestId } });
}
