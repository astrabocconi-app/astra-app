import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getPartnerForUser, partnerStats } from "@/lib/partner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/partner/stats — scan tallies for the signed-in partner venue.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  const membership = await getPartnerForUser(session.user.id);
  if (!membership || !session.user.roles.includes("PARTNER_MANAGER")) {
    return errorResponse(403, "FORBIDDEN", "Not a partner account.", requestId);
  }
  // Enforced here, not just hidden in the app: a scan-only login must not be
  // able to read takings by calling the API directly.
  if (membership.scanOnly) {
    return errorResponse(403, "FORBIDDEN", "This account can only scan.", requestId);
  }
  const stats = await partnerStats(membership.partnerId);
  return NextResponse.json(
    { partner: { id: membership.partnerId, name: membership.partner.name }, ...stats },
    { headers: { "x-request-id": requestId } },
  );
}
