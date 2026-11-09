import { NextResponse } from "next/server";
import { prisma, type Prisma } from "@astra/db";
import { APP_CONTENT_SCHEMAS, type AppContentKey } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function schemaFor(key: string) {
  return Object.hasOwn(APP_CONTENT_SCHEMAS, key) ? APP_CONTENT_SCHEMAS[key as AppContentKey] : null;
}

// GET /api/admin/content/:key — the stored document, or the defaults when unset.
// Media paths stay relative (/api/media/:id) so a re-save is stable.
async function handleGet(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "app-content");
  if ("error" in guard) return guard.error;
  const { key } = await ctx.params;
  const schema = schemaFor(key);
  if (!schema) return errorResponse(404, "NOT_FOUND", "Unknown content key.", requestId);

  const row = await prisma.appContent.findUnique({ where: { key } });
  const parsed = schema.safeParse(row?.data ?? {});
  return NextResponse.json({
    key,
    data: parsed.success ? parsed.data : schema.parse({}),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  });
}

// PUT /api/admin/content/:key — replace the document (validated against its schema).
async function handlePut(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "app-content");
  if ("error" in guard) return guard.error;
  const { key } = await ctx.params;
  const schema = schemaFor(key);
  if (!schema) return errorResponse(404, "NOT_FOUND", "Unknown content key.", requestId);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  const data = parsed.data as Prisma.InputJsonValue;

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.appContent.upsert({
      where: { key },
      create: { key, data, updatedById: guard.session.user.id },
      update: { data, updatedById: guard.session.user.id },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "update",
        targetType: "AppContent",
        targetId: key,
        metadata: { enabled: (parsed.data as { enabled?: boolean }).enabled ?? null },
      },
      tx,
    );
    return saved;
  });
  return NextResponse.json({ key, data: parsed.data, updatedAt: row.updatedAt.toISOString() });
}

export const GET = withApi(handleGet);
export const PUT = withApi(handlePut);
