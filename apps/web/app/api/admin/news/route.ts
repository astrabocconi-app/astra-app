import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newsInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toNewsItem } from "@/lib/cms-map";
import { sendPushToAll } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/news — all posts (drafts + published), newest first.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const rows = await prisma.newsPost.findMany({
    where: { deletedAt: null },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(
    { items: rows.map((r) => toNewsItem(r)) },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/news — create a post.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const raw = await req.json().catch(() => null);
  const notify = raw?.notify === true; // not stored; a per-save action
  const parsed = newsInput.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const d = parsed.data;
  const created = await prisma.newsPost.create({
    data: {
      title: d.title,
      body: d.body,
      excerpt: d.excerpt ?? null,
      coverImageKey: d.imageUrl ?? null,
      published: d.published,
      pinned: d.pinned,
      publishedAt: d.published ? new Date() : null,
      authorId: guard.session.user.id,
    },
  });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "create",
    targetType: "NewsPost",
    targetId: created.id,
    metadata: { title: created.title, published: created.published },
  });
  if (notify && created.published) {
    await sendPushToAll({
      title: created.title,
      body: created.excerpt ?? created.body.slice(0, 140),
      data: { type: "news", id: created.id },
    });
  }
  return NextResponse.json(toNewsItem(created), { status: 201, headers: { "x-request-id": requestId } });
}
