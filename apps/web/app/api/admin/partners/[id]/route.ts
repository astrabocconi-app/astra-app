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

// PATCH /api/admin/partners/:id — update fields and/or replace the discount set.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.partner.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Partner not found.", requestId);

  const parsed = partnerInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.partner.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.description !== undefined ? { description: d.description ?? null } : {}),
        ...(d.category !== undefined ? { category: d.category ?? null } : {}),
        ...(d.address !== undefined ? { address: d.address ?? null } : {}),
        ...(d.latitude !== undefined ? { latitude: d.latitude ?? null } : {}),
        ...(d.longitude !== undefined ? { longitude: d.longitude ?? null } : {}),
        ...(d.logoUrl !== undefined ? { logoKey: d.logoUrl ?? null } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    // Only touch offers when the caller actually sent a set — a partial update
    // that omits `offers` must not wipe the partner's discounts.
    if (d.offers !== undefined) await syncPartnerOffers(tx, id, d.offers);
    return tx.partner.findUniqueOrThrow({ where: { id }, include: activeOffers });
  });

  await writeAudit({
    actorId: guard.session.user.id,
    action: d.active === undefined ? "update" : d.active ? "publish" : "unpublish",
    targetType: "Partner",
    targetId: id,
    metadata: { name: updated.name },
  });
  return NextResponse.json(toPartnerItem(updated), { headers: { "x-request-id": requestId } });
}

// DELETE /api/admin/partners/:id — soft delete the venue and its discounts.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.partner.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Partner not found.", requestId);

  const now = new Date();
  await prisma.$transaction([
    prisma.partner.update({ where: { id }, data: { deletedAt: now, active: false } }),
    // Soft-delete, never hard-delete: DiscountUsage cascades off Offer.
    prisma.offer.updateMany({
      where: { partnerId: id, deletedAt: null },
      data: { deletedAt: now, active: false },
    }),
  ]);

  await writeAudit({
    actorId: guard.session.user.id,
    action: "delete",
    targetType: "Partner",
    targetId: id,
    metadata: { name: existing.name },
  });
  return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
}
