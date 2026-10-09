import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { partnerPatchInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit, changedFields, auditVerb } from "@/lib/audit";
import { toPartnerItem } from "@/lib/cms-map";
import { syncPartnerOffers } from "@/lib/partners";
import { resolveCoordinates } from "@/lib/partner-location";
import { endVenueSessions, revokeVenueLogins } from "@/lib/partner-accounts";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activeOffers = {
  offers: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
} as const;

const FIELDS = ["name", "description", "category", "address", "latitude", "longitude", "logoUrl", "photoUrl", "active"] as const;

// PATCH /api/admin/partners/:id — update fields and/or replace the discount set.
async function handlePatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "partners");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.partner.findFirst({ where: { id, deletedAt: null }, include: activeOffers });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Partner not found.", requestId);

  const parsed = partnerPatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;

  // Location: explicit coordinates win, but only when staff actually chose them.
  // The edit form always sends the stored pin back, so coordinates identical to
  // the stored ones next to a CHANGED address mean "untouched": re-derive the pin
  // from the new address instead of keeping the old one forever.
  const addressChanged = d.address !== undefined && (d.address ?? null) !== existing.address;
  const coordsGiven = d.latitude != null && d.longitude != null;
  const coordsMoved = coordsGiven && (d.latitude !== existing.latitude || d.longitude !== existing.longitude);
  let location: { latitude: number | null; longitude: number | null } | null = null;
  if (coordsGiven && (coordsMoved || !addressChanged)) {
    location = { latitude: d.latitude ?? null, longitude: d.longitude ?? null };
  } else if (addressChanged) {
    const coords = await resolveCoordinates({ address: d.address, latitude: null, longitude: null });
    location = { latitude: coords.latitude, longitude: coords.longitude };
  }

  const next = {
    name: d.name ?? existing.name,
    description: d.description !== undefined ? d.description : existing.description,
    category: d.category !== undefined ? d.category : existing.category,
    address: d.address !== undefined ? d.address : existing.address,
    latitude: location ? location.latitude : existing.latitude,
    longitude: location ? location.longitude : existing.longitude,
    logoUrl: d.logoUrl !== undefined ? d.logoUrl : existing.logoKey,
    photoUrl: d.photoUrl !== undefined ? d.photoUrl : existing.photoKey,
    active: d.active ?? existing.active,
  };
  const changes = changedFields({ ...existing, logoUrl: existing.logoKey, photoUrl: existing.photoKey }, next, FIELDS);
  const offersChanged =
    d.offers !== undefined &&
    JSON.stringify(
      d.offers.map((o) => [o.id ?? null, o.title, o.description, o.discountType, o.discountValue ?? null, o.qrEnabled]),
    ) !==
      JSON.stringify(
        existing.offers.map((o) => [o.id, o.title, o.description, o.discountType, o.discountValue, o.qrEnabled]),
      );
  if (offersChanged) changes.offers = [existing.offers.length, d.offers!.length];
  if (Object.keys(changes).length === 0) {
    return NextResponse.json(toPartnerItem(existing));
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.partner.update({
      where: { id },
      data: {
        name: next.name,
        description: next.description,
        category: next.category,
        address: next.address,
        latitude: next.latitude,
        longitude: next.longitude,
        logoKey: next.logoUrl,
        photoKey: next.photoUrl,
        active: next.active,
      },
    });
    // Only touch offers when the caller actually sent a set — a partial update
    // that omits `offers` must not wipe the partner's discounts.
    if (d.offers !== undefined) await syncPartnerOffers(tx, id, d.offers);
    // Hiding a venue ends its staff's sessions: it must not keep awarding points.
    if (existing.active && !next.active) await endVenueSessions(tx, id);
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: auditVerb(changes, "active"),
        targetType: "Partner",
        targetId: id,
        metadata: { name: next.name, changes },
      },
      tx,
    );
    return tx.partner.findUniqueOrThrow({ where: { id }, include: activeOffers });
  });
  return NextResponse.json(toPartnerItem(updated));
}

// DELETE /api/admin/partners/:id — soft delete the venue and its discounts, and
// revoke its logins (sessions, memberships): ending a partnership must end its
// staff's power to award points.
async function handleDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "partners");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.partner.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Partner not found.", requestId);

  const now = new Date();
  const logins = await prisma.$transaction(async (tx) => {
    await tx.partner.update({ where: { id }, data: { deletedAt: now, active: false } });
    // Soft-delete, never hard-delete: DiscountUsage cascades off Offer.
    await tx.offer.updateMany({
      where: { partnerId: id, deletedAt: null },
      data: { deletedAt: now, active: false },
    });
    const revoked = await revokeVenueLogins(tx, id);
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "delete",
        targetType: "Partner",
        targetId: id,
        metadata: { name: existing.name, loginsRevoked: revoked },
      },
      tx,
    );
    return revoked;
  });
  return NextResponse.json({ ok: true, loginsRevoked: logins });
}

export const PATCH = withApi(handlePatch);
export const DELETE = withApi(handleDelete);
