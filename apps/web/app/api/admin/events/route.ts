import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { eventInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toEventItem } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/events — all events (drafts + published), soonest first.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "events");
  if ("error" in guard) return guard.error;

  const rows = await prisma.event.findMany({
    where: { deletedAt: null },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json(
    { items: rows.map((r) => toEventItem(r)) },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/events — create an event.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "events");
  if ("error" in guard) return guard.error;

  const parsed = eventInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return errorResponse(400, "BAD_REQUEST", "Invalid start date.", requestId);
  }
  const endsAt = d.endsAt ? new Date(d.endsAt) : null;

  const created = await prisma.event.create({
    data: {
      title: d.title,
      description: d.description ?? null,
      coverImageKey: d.imageUrl ?? null,
      location: d.location ?? null,
      startsAt,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
      externalTicketUrl: d.externalTicketUrl ?? null,
      published: d.published,
      links: d.links,
    },
  });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "create",
    targetType: "Event",
    targetId: created.id,
    metadata: { title: created.title, published: created.published },
  });
  return NextResponse.json(toEventItem(created), { status: 201, headers: { "x-request-id": requestId } });
}
