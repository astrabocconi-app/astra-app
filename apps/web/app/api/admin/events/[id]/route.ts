import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { eventPatchInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit, changedFields, auditVerb } from "@/lib/audit";
import { toEventItem } from "@/lib/cms-map";
import { discountProblem } from "@/lib/ticket-url";
import { revokeDiscounts } from "@/lib/eventbrite-revoke";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FIELDS = [
  "title",
  "description",
  "imageUrl",
  "location",
  "startsAt",
  "endsAt",
  "externalTicketUrl",
  "published",
  "links",
  "eventbriteEventId",
  "appDiscountPercent",
  "appDiscountLimit",
] as const;

// PATCH /api/admin/events/:id — update (incl. publish/unpublish).
async function handlePatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "events");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.event.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Event not found.", requestId);

  const parsed = eventPatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;

  const next = {
    title: d.title ?? existing.title,
    description: d.description !== undefined ? d.description : existing.description,
    imageUrl: d.imageUrl !== undefined ? d.imageUrl : existing.coverImageKey,
    location: d.location !== undefined ? d.location : existing.location,
    startsAt: d.startsAt !== undefined ? new Date(d.startsAt) : existing.startsAt,
    endsAt: d.endsAt !== undefined ? (d.endsAt ? new Date(d.endsAt) : null) : existing.endsAt,
    externalTicketUrl: d.externalTicketUrl !== undefined ? d.externalTicketUrl : existing.externalTicketUrl,
    published: d.published ?? existing.published,
    links: d.links ?? existing.links,
    eventbriteEventId: d.eventbriteEventId !== undefined ? d.eventbriteEventId : existing.eventbriteEventId,
    appDiscountPercent: d.appDiscountPercent !== undefined ? d.appDiscountPercent : existing.appDiscountPercent,
    appDiscountLimit: d.appDiscountLimit !== undefined ? d.appDiscountLimit : existing.appDiscountLimit,
  };
  // A new start can land after the stored end (or the reverse) even when each is valid alone.
  if (next.endsAt && next.endsAt < next.startsAt) {
    return errorResponse(400, "BAD_REQUEST", "End: End can't be before the start", requestId);
  }
  const problem = discountProblem(next.appDiscountPercent, next.eventbriteEventId, next.externalTicketUrl);
  if (problem) return errorResponse(400, "BAD_REQUEST", problem, requestId);

  const changes = changedFields(
    {
      ...existing,
      imageUrl: existing.coverImageKey,
      startsAt: existing.startsAt.toISOString(),
      endsAt: existing.endsAt?.toISOString() ?? null,
    },
    { ...next, startsAt: next.startsAt.toISOString(), endsAt: next.endsAt?.toISOString() ?? null },
    FIELDS,
  );
  if (Object.keys(changes).length === 0) {
    return NextResponse.json(toEventItem(existing));
  }

  // Codes already handed out were minted for the old Eventbrite event; checkout
  // on the new one rejects them. Make the admin say they mean it.
  if (changes.eventbriteEventId && !d.forceRelink) {
    const issued = await prisma.eventAppDiscount.count({ where: { eventId: id, eventbriteDiscountId: { not: "" } } });
    if (issued > 0) {
      return errorResponse(
        409,
        "CODES_ISSUED",
        `${issued} student${issued === 1 ? " already holds" : "s already hold"} a discount code for the current Eventbrite event. Their codes will stop working if you re-link it. Send forceRelink to confirm.`,
        requestId,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.event.update({
      where: { id },
      data: {
        title: next.title,
        description: next.description,
        coverImageKey: next.imageUrl,
        location: next.location,
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        externalTicketUrl: next.externalTicketUrl,
        published: next.published,
        links: next.links ?? undefined,
        // Codes already handed out keep the percent they were created with.
        eventbriteEventId: next.eventbriteEventId,
        appDiscountPercent: next.appDiscountPercent,
        appDiscountLimit: next.appDiscountLimit,
      },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: auditVerb(changes, "published"),
        targetType: "Event",
        targetId: id,
        metadata: { title: row.title, changes },
      },
      tx,
    );
    return row;
  });
  return NextResponse.json(toEventItem(updated));
}

// DELETE /api/admin/events/:id — soft delete, and revoke the in-app discount
// codes issued for it (they are live on Eventbrite until someone removes them).
async function handleDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "events");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.event.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Event not found.", requestId);

  const discounts = await prisma.eventAppDiscount.findMany({
    where: { eventId: id, eventbriteDiscountId: { not: "" } },
    select: { eventbriteDiscountId: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id }, data: { deletedAt: new Date(), published: false } });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "delete",
        targetType: "Event",
        targetId: id,
        metadata: { title: existing.title, discountsRevoked: discounts.length },
      },
      tx,
    );
  });
  const revocation = await revokeDiscounts(discounts.map((x) => x.eventbriteDiscountId));
  return NextResponse.json({ ok: true, revoked: revocation.revoked, revokePending: revocation.pending });
}

export const PATCH = withApi(handlePatch);
export const DELETE = withApi(handleDelete);
