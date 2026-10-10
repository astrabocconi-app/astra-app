import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { polareInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { toPolarePost } from "@/lib/cms-map";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/polare — all posts (drafts + published), pinned then newest.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "polare");
  if ("error" in guard) return guard.error;

  const rows = await prisma.polarePost.findMany({
    where: { deletedAt: null },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return NextResponse.json({ items: rows.map((r) => toPolarePost(r)) });
}

// POST /api/admin/polare — create a post.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "polare");
  if ("error" in guard) return guard.error;

  const parsed = polareInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  const d = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.polarePost.create({
      data: {
        kind: d.kind,
        caption: d.caption,
        media: d.media,
        externalUrl: d.externalUrl,
        pinned: d.pinned,
        published: d.published,
        publishedAt: d.publishedAt ? new Date(d.publishedAt) : d.published ? new Date() : null,
        authorId: guard.session.user.id,
      },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "create",
        targetType: "PolarePost",
        targetId: post.id,
        metadata: { kind: post.kind, published: post.published },
      },
      tx,
    );
    return post;
  });
  return NextResponse.json(toPolarePost(created), { status: 201 });
}

export const GET = withApi(handleGet);
export const POST = withApi(handlePost);
