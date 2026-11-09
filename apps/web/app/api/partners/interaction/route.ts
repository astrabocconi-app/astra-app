import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { venueInteractionInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/partners/interaction — count a venue page view, an offer-link tap or
// a directions tap, for the backoffice BI page. Signed-in students only, so the
// numbers are not open to anyone with curl, but the row stores no user id: it
// is a counter, not a trail of who looked at what.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = venueInteractionInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "BAD_REQUEST", "Bad interaction.", requestId);
  const { partnerId, offerId, kind } = parsed.data;

  // Only live venues (and an offer that belongs to that venue) are counted.
  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, deletedAt: null, active: true },
    select: { id: true, offers: offerId ? { where: { id: offerId }, select: { id: true } } : false },
  });
  if (!partner) return errorResponse(404, "NOT_FOUND", "Venue not found.", requestId);
  const offerOk = offerId && "offers" in partner && Array.isArray(partner.offers) && partner.offers.length > 0;

  await prisma.venueInteraction.create({
    data: { partnerId, offerId: offerOk ? offerId : null, kind },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export const POST = withApi(handlePost);
