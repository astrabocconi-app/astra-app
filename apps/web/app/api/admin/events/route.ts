import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { eventInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toEventItem } from "@/lib/cms-map";
import { discountProblem } from "@/lib/ticket-url";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/events — all events (drafts + published), soonest first.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "events");
  if ("error" in guard) return guard.error;

  const rows = await prisma.event.findMany({
    where: { deletedAt: null },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 1000,
  });
  return NextResponse.json({ items: rows.map((r) => toEventItem(r)) });
}

// POST /api/admin/events — create an event.
//
// startsAt / endsAt arrive as ISO strings WITH an offset (the dashboard converts
// Milan wall time), so the instant stored is exactly the one staff meant.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "events");
  if ("error" in guard) return guard.error;

  const parsed = eventInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;
  const problem = discountProblem(d.appDiscountPercent, d.eventbriteEventId, d.externalTicketUrl);
  if (problem) return errorResponse(400, "BAD_REQUEST", problem, requestId);

  const created = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        title: d.title,
        description: d.description,
        coverImageKey: d.imageUrl ?? null,
        location: d.location,
        startsAt: new Date(d.startsAt),
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        externalTicketUrl: d.externalTicketUrl ?? null,
        published: d.published,
        links: d.links,
        eventbriteEventId: d.eventbriteEventId ?? null,
        appDiscountPercent: d.appDiscountPercent ?? null,
        appDiscountLimit: d.appDiscountLimit ?? null,
      },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "create",
        targetType: "Event",
        targetId: event.id,
        metadata: { title: event.title, published: event.published },
      },
      tx,
    );
    return event;
  });
  return NextResponse.json(toEventItem(created), { status: 201 });
}

export const GET = withApi(handleGet);
export const POST = withApi(handlePost);
