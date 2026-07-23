import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newsInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toNewsItem } from "@/lib/cms-map";

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
    { items: rows.map(toNewsItem) },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/news — create a post.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const parsed = newsInput.safeParse(await req.json().catch(() => null));
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
  return NextResponse.json(toNewsItem(created), { status: 201, headers: { "x-request-id": requestId } });
}
