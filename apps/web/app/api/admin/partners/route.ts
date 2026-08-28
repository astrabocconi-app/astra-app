import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { partnerInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toPartnerItem } from "@/lib/cms-map";
import { syncPartnerOffers } from "@/lib/partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activeOffers = {
  offers: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
} as const;

// GET /api/admin/partners — every partner (active + hidden), A→Z.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const rows = await prisma.partner.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: activeOffers,
  });
  return NextResponse.json(
    { items: rows.map((p) => toPartnerItem(p)) },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/partners — create a partner venue and its discounts.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const parsed = partnerInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        category: d.category ?? null,
        address: d.address ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        logoKey: d.logoUrl ?? null,
        active: d.active,
      },
    });
    await syncPartnerOffers(tx, partner.id, d.offers);
    return tx.partner.findUniqueOrThrow({ where: { id: partner.id }, include: activeOffers });
  });

  await writeAudit({
    actorId: guard.session.user.id,
    action: "create",
    targetType: "Partner",
    targetId: created.id,
    metadata: { name: created.name, offers: created.offers.length },
  });
  return NextResponse.json(toPartnerItem(created), {
    status: 201,
    headers: { "x-request-id": requestId },
  });
}
