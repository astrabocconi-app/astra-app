import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newsInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toNewsItem } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/news/:id — update (incl. publish/unpublish, pin).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.newsPost.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "News post not found.", requestId);

  const parsed = newsInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;

  // publishedAt is set the first time it goes live, cleared when unpublished.
  let publishedAt = existing.publishedAt;
  if (d.published === true && !existing.published) publishedAt = new Date();
  if (d.published === false) publishedAt = null;

  const updated = await prisma.newsPost.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.body !== undefined ? { body: d.body } : {}),
      ...(d.excerpt !== undefined ? { excerpt: d.excerpt ?? null } : {}),
      ...(d.imageUrl !== undefined ? { coverImageKey: d.imageUrl ?? null } : {}),
      ...(d.published !== undefined ? { published: d.published } : {}),
      ...(d.pinned !== undefined ? { pinned: d.pinned } : {}),
      publishedAt,
    },
  });
  await writeAudit({
    actorId: guard.session.user.id,
    action: d.published === undefined ? "update" : d.published ? "publish" : "unpublish",
    targetType: "NewsPost",
    targetId: id,
    metadata: { title: updated.title },
  });
  return NextResponse.json(toNewsItem(updated), { headers: { "x-request-id": requestId } });
}

// DELETE /api/admin/news/:id — soft delete.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.newsPost.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "News post not found.", requestId);

  await prisma.newsPost.update({ where: { id }, data: { deletedAt: new Date(), published: false } });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "delete",
    targetType: "NewsPost",
    targetId: id,
    metadata: { title: existing.title },
  });
  return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
}
