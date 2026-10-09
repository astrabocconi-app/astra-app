import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { partnerInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toPartnerItem } from "@/lib/cms-map";
import { syncPartnerOffers } from "@/lib/partners";
import { resolveCoordinates } from "@/lib/partner-location";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activeOffers = {
  offers: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
} as const;

// GET /api/admin/partners — every partner (active + hidden), A→Z.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "partners");
  if ("error" in guard) return guard.error;

  const rows = await prisma.partner.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: activeOffers,
    take: 1000,
  });
  return NextResponse.json({ items: rows.map((p) => toPartnerItem(p)) });
}

// POST /api/admin/partners — create a partner venue and its discounts.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "partners");
  if ("error" in guard) return guard.error;

  const parsed = partnerInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;
  // Pin comes from the address unless coordinates were given explicitly.
  const coords = await resolveCoordinates({
    address: d.address,
    latitude: d.latitude,
    longitude: d.longitude,
  });

  const created = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.create({
      data: {
        name: d.name,
        description: d.description,
        category: d.category,
        address: d.address,
        latitude: coords.latitude,
        longitude: coords.longitude,
        logoKey: d.logoUrl ?? null,
        photoKey: d.photoUrl ?? null,
        active: d.active,
      },
    });
    await syncPartnerOffers(tx, partner.id, d.offers);
    const full = await tx.partner.findUniqueOrThrow({ where: { id: partner.id }, include: activeOffers });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "create",
        targetType: "Partner",
        targetId: partner.id,
        metadata: { name: full.name, offers: full.offers.length },
      },
      tx,
    );
    return full;
  });
  return NextResponse.json(toPartnerItem(created), { status: 201 });
}

export const GET = withApi(handleGet);
export const POST = withApi(handlePost);
