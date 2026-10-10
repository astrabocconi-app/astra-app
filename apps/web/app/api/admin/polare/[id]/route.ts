import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { polarePatchInput, mergePolare } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit, changedFields, auditVerb } from "@/lib/audit";
import { toPolarePost } from "@/lib/cms-map";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = ["kind", "caption", "media", "externalUrl", "published", "pinned", "publishedAt"] as const;

// GET /api/admin/polare/:id
async function handleGet(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "polare");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;
  const row = await prisma.polarePost.findFirst({ where: { id, deletedAt: null } });
  if (!row) return errorResponse(404, "NOT_FOUND", "Post not found.", requestId);
  return NextResponse.json(toPolarePost(row));
}

// PATCH /api/admin/polare/:id — update (incl. publish/unpublish, pin).
async function handlePatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "polare");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.polarePost.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Post not found.", requestId);

  const patch = polarePatchInput.safeParse(await req.json().catch(() => null));
  if (!patch.success) return errorResponse(400, "BAD_REQUEST", zodMessage(patch.error), requestId);
  const d = patch.data;

  // The patch schema can't see the stored kind/media; check the merged post.
  const merged = mergePolare(existing, d);
  if (!merged.success) return errorResponse(400, "BAD_REQUEST", zodMessage(merged.error), requestId);
  const m = merged.data;

  // An explicit date wins; otherwise it is set the first time the post goes live.
  const publishedAt = d.publishedAt
    ? new Date(d.publishedAt)
    : m.published && !existing.publishedAt
      ? new Date()
      : existing.publishedAt;

  const before = { ...existing, publishedAt: existing.publishedAt?.toISOString() ?? null };
  const next = { ...m, publishedAt: publishedAt?.toISOString() ?? null };
  const changes = changedFields(before, next, FIELDS);

  let updated = existing;
  if (Object.keys(changes).length > 0) {
    updated = await prisma.$transaction(async (tx) => {
      const row = await tx.polarePost.update({
        where: { id },
        data: {
          kind: m.kind,
          caption: m.caption,
          media: m.media,
          externalUrl: m.externalUrl,
          published: m.published,
          pinned: m.pinned,
          publishedAt,
        },
      });
      await writeAudit(
        {
          actorId: guard.session.user.id,
          action: auditVerb(changes, "published"),
          targetType: "PolarePost",
          targetId: id,
          metadata: { kind: row.kind, changes },
        },
        tx,
      );
      return row;
    });
  }
  return NextResponse.json(toPolarePost(updated));
}

// DELETE /api/admin/polare/:id — soft delete.
async function handleDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "polare");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.polarePost.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Post not found.", requestId);

  await prisma.$transaction(async (tx) => {
    await tx.polarePost.update({ where: { id }, data: { deletedAt: new Date(), published: false } });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "delete",
        targetType: "PolarePost",
        targetId: id,
        metadata: { kind: existing.kind },
      },
      tx,
    );
  });
  return NextResponse.json({ ok: true });
}

export const GET = withApi(handleGet);
export const PATCH = withApi(handlePatch);
export const DELETE = withApi(handleDelete);
