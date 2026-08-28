import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { verifyCardToken } from "@/lib/card-token";
import { awardScan, getPartnerForUser, POINTS_PER_SCAN } from "@/lib/partner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/partner/scan { token } — a partner scans a student's card QR and
// awards points. Auth: the caller must be a PARTNER_MANAGER with a membership.
// (Cooldown / replay-block are deferred — see Phase 5 notes.)
export async function POST(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  const membership = await getPartnerForUser(session.user.id);
  if (!membership || !session.user.roles.includes("PARTNER_MANAGER")) {
    return errorResponse(403, "FORBIDDEN", "Not a partner account.", requestId);
  }

  const body = (await req.json().catch(() => null)) as
    | { token?: string; offerId?: string | null }
    | null;
  const token = body?.token;
  if (typeof token !== "string" || !token) {
    return errorResponse(400, "BAD_REQUEST", "Missing card token.", requestId);
  }

  const verified = verifyCardToken(token);
  if (!verified) {
    return errorResponse(400, "INVALID_CODE", "Invalid or expired code.", requestId);
  }

  // Which promotion this scan was for. Validated against THIS venue's live
  // offers so a client can't attribute a scan to another partner's promotion
  // (or to a retired one) by passing an arbitrary id.
  let offer: { id: string; title: string } | null = null;
  if (body?.offerId) {
    offer = await prisma.offer.findFirst({
      where: {
        id: body.offerId,
        partnerId: membership.partnerId,
        active: true,
        deletedAt: null,
      },
      select: { id: true, title: true },
    });
    if (!offer) {
      return errorResponse(400, "BAD_REQUEST", "That offer isn't available here.", requestId);
    }
  }

  const student = await prisma.user.findFirst({
    where: { id: verified.userId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!student) {
    return errorResponse(404, "NOT_FOUND", "Unknown member.", requestId);
  }

  const balance = await awardScan({
    studentId: student.id,
    partnerUserId: session.user.id,
    partnerId: membership.partnerId,
    partnerName: membership.partner.name,
    offerId: offer?.id ?? null,
    offerTitle: offer?.title ?? null,
  });

  return NextResponse.json(
    {
      awarded: POINTS_PER_SCAN,
      student: { name: student.name },
      balance,
      offer: offer ? { id: offer.id, title: offer.title } : null,
    },
    { headers: { "x-request-id": requestId } },
  );
}
