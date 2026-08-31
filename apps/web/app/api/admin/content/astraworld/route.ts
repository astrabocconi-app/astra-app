import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { astraWorldContent } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "astraworld";

// GET /api/admin/content/astraworld — current stored content, if any.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "astraworld");
  if ("error" in guard) return guard.error;

  const row = await prisma.appContent.findUnique({
    where: { key: KEY },
    include: { updatedBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json(
    {
      // null means "never edited" — the dashboard then seeds the form from the
      // app's own defaults rather than showing empty fields.
      data: row?.data ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: row?.updatedBy?.name ?? row?.updatedBy?.email ?? null,
    },
    { headers: { "x-request-id": requestId } },
  );
}

// PUT /api/admin/content/astraworld — replace the stored content.
export async function PUT(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "astraworld");
  if ("error" in guard) return guard.error;

  // Validated against the same schema the app parses with, so the dashboard
  // cannot store something the screen would then reject and silently ignore.
  const parsed = astraWorldContent.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return errorResponse(
      400,
      "BAD_REQUEST",
      issue ? `${issue.path.join(".") || "content"}: ${issue.message}` : "Invalid content.",
      requestId,
    );
  }

  const row = await prisma.appContent.upsert({
    where: { key: KEY },
    update: { data: parsed.data, updatedById: guard.session.user.id },
    create: { key: KEY, data: parsed.data, updatedById: guard.session.user.id },
  });

  await writeAudit({
    actorId: guard.session.user.id,
    action: "update",
    targetType: "AppContent",
    targetId: KEY,
    metadata: { slots: parsed.data.slots.length, visible: parsed.data.visible },
  });

  return NextResponse.json(
    { updatedAt: row.updatedAt.toISOString() },
    { headers: { "x-request-id": requestId } },
  );
}

// DELETE — drop the override so the app falls back to its bundled copy.
export async function DELETE(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "astraworld");
  if ("error" in guard) return guard.error;

  await prisma.appContent.deleteMany({ where: { key: KEY } });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "delete",
    targetType: "AppContent",
    targetId: KEY,
  });
  return NextResponse.json({ reverted: true }, { headers: { "x-request-id": requestId } });
}
