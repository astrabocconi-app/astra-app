import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newsPatchInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { canAccessPage } from "@/lib/dashboard-access";
import { writeAudit, changedFields, auditVerb } from "@/lib/audit";
import { toNewsItem } from "@/lib/cms-map";
import { notifyNewsPost, shouldNotify } from "@/lib/news-push";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FIELDS = ["title", "body", "excerpt", "imageUrl", "published", "pinned", "links"] as const;

// PATCH /api/admin/news/:id — update (incl. publish/unpublish, pin).
async function handlePatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "news");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.newsPost.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "News post not found.", requestId);

  const raw = await req.json().catch(() => null);
  const notify = raw?.notify === true;
  if (notify && !canAccessPage(guard.session, "push")) {
    return errorResponse(403, "FORBIDDEN", "You need the Notifications page to notify students.", requestId);
  }
  const parsed = newsPatchInput.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;

  // publishedAt is set the first time it goes live, cleared when unpublished.
  let publishedAt = existing.publishedAt;
  if (d.published === true && !existing.published) publishedAt = new Date();
  if (d.published === false) publishedAt = null;

  const before = { ...existing, imageUrl: existing.coverImageKey };
  const next = {
    title: d.title ?? existing.title,
    body: d.body ?? existing.body,
    excerpt: d.excerpt !== undefined ? d.excerpt : existing.excerpt,
    imageUrl: d.imageUrl !== undefined ? d.imageUrl : existing.coverImageKey,
    published: d.published ?? existing.published,
    pinned: d.pinned ?? existing.pinned,
    links: d.links ?? existing.links,
  };
  const changes = changedFields(before, next, FIELDS);

  let updated = existing;
  if (Object.keys(changes).length > 0) {
    updated = await prisma.$transaction(async (tx) => {
      const row = await tx.newsPost.update({
        where: { id },
        data: {
          title: next.title,
          body: next.body,
          excerpt: next.excerpt,
          coverImageKey: next.imageUrl,
          published: next.published,
          pinned: next.pinned,
          links: next.links ?? undefined,
          publishedAt,
        },
      });
      await writeAudit(
        {
          actorId: guard.session.user.id,
          action: auditVerb(changes, "published"),
          targetType: "NewsPost",
          targetId: id,
          metadata: { title: row.title, changes },
        },
        tx,
      );
      return row;
    });
  }

  // Only the first time a post goes out, unless someone explicitly asks again.
  const notified = shouldNotify({
    requested: notify,
    published: updated.published,
    alreadyPushedAt: existing.pushedAt,
    notifyAgain: raw?.notifyAgain === true,
  })
    ? await notifyNewsPost(updated, guard.session.user.id)
    : notify && updated.published && existing.pushedAt
      ? { sent: false, reason: "already_sent" as const }
      : null;
  return NextResponse.json({ ...toNewsItem(updated), ...(notified ? { notify: notified } : {}) });
}

// DELETE /api/admin/news/:id — soft delete.
async function handleDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "news");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.newsPost.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "News post not found.", requestId);

  await prisma.$transaction(async (tx) => {
    await tx.newsPost.update({ where: { id }, data: { deletedAt: new Date(), published: false } });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "delete",
        targetType: "NewsPost",
        targetId: id,
        metadata: { title: existing.title },
      },
      tx,
    );
  });
  return NextResponse.json({ ok: true });
}

export const PATCH = withApi(handlePatch);
export const DELETE = withApi(handleDelete);
