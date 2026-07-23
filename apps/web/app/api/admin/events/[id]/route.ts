import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { eventInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toEventItem } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/events/:id — update (incl. publish/unpublish).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.event.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Event not found.", requestId);

  const parsed = eventInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;

  let startsAt: Date | undefined;
  if (d.startsAt !== undefined) {
    startsAt = new Date(d.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return errorResponse(400, "BAD_REQUEST", "Invalid start date.", requestId);
    }
  }
  const endsAt = d.endsAt !== undefined ? (d.endsAt ? new Date(d.endsAt) : null) : undefined;

  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      ...(d.imageUrl !== undefined ? { coverImageKey: d.imageUrl ?? null } : {}),
      ...(d.location !== undefined ? { location: d.location ?? null } : {}),
      ...(startsAt !== undefined ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null } : {}),
      ...(d.externalTicketUrl !== undefined ? { externalTicketUrl: d.externalTicketUrl ?? null } : {}),
      ...(d.published !== undefined ? { published: d.published } : {}),
    },
  });
  await writeAudit({
    actorId: guard.session.user.id,
    action: d.published === undefined ? "update" : d.published ? "publish" : "unpublish",
    targetType: "Event",
    targetId: id,
    metadata: { title: updated.title },
  });
  return NextResponse.json(toEventItem(updated), { headers: { "x-request-id": requestId } });
}

// DELETE /api/admin/events/:id — soft delete.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.event.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Event not found.", requestId);

  await prisma.event.update({ where: { id }, data: { deletedAt: new Date(), published: false } });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "delete",
    targetType: "Event",
    targetId: id,
    metadata: { title: existing.title },
  });
  return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
}
