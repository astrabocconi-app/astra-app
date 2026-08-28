import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getPartnerForUser } from "@/lib/partner";
import { offerLabel } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/partner/offers — the venue's live promotions, so the scanner can ask
// which one a scan was for. Available to every partner login including
// scan-only ones: choosing the offer is part of scanning, not analytics.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const membership = await getPartnerForUser(session.user.id);
  if (!membership || !session.user.roles.includes("PARTNER_MANAGER")) {
    return errorResponse(403, "FORBIDDEN", "Not a partner account.", requestId);
  }

  const offers = await prisma.offer.findMany({
    where: { partnerId: membership.partnerId, active: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    {
      partner: { id: membership.partnerId, name: membership.partner.name },
      offers: offers.map((o) => ({ id: o.id, title: o.title, label: offerLabel(o) })),
    },
    { headers: { "x-request-id": requestId } },
  );
}
