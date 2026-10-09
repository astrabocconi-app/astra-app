import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newsInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { canAccessPage } from "@/lib/dashboard-access";
import { writeAudit } from "@/lib/audit";
import { toNewsItem } from "@/lib/cms-map";
import { notifyNewsPost, shouldNotify } from "@/lib/news-push";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/admin/news — all posts (drafts + published), newest first.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "news");
  if ("error" in guard) return guard.error;

  const rows = await prisma.newsPost.findMany({
    where: { deletedAt: null },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return NextResponse.json({ items: rows.map((r) => toNewsItem(r)) });
}

// POST /api/admin/news — create a post.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "news");
  if ("error" in guard) return guard.error;

  const raw = await req.json().catch(() => null);
  const notify = raw?.notify === true; // not stored; a per-save action
  // Notifying every student is the Notifications page's power, not the News page's.
  if (notify && !canAccessPage(guard.session, "push")) {
    return errorResponse(403, "FORBIDDEN", "You need the Notifications page to notify students.", requestId);
  }
  const parsed = newsInput.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const d = parsed.data;
  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.newsPost.create({
      data: {
        title: d.title,
        body: d.body,
        excerpt: d.excerpt,
        coverImageKey: d.imageUrl ?? null,
        published: d.published,
        pinned: d.pinned,
        links: d.links,
        publishedAt: d.published ? new Date() : null,
        authorId: guard.session.user.id,
      },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "create",
        targetType: "NewsPost",
        targetId: post.id,
        metadata: { title: post.title, published: post.published },
      },
      tx,
    );
    return post;
  });

  const notified = shouldNotify({ requested: notify, published: created.published, alreadyPushedAt: null, notifyAgain: false })
    ? await notifyNewsPost(created, guard.session.user.id)
    : null;
  return NextResponse.json(
    { ...toNewsItem(created), ...(notified ? { notify: notified } : {}) },
    { status: 201 },
  );
}

export const GET = withApi(handleGet);
export const POST = withApi(handlePost);
