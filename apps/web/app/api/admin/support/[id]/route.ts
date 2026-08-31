import { NextResponse } from "next/server";
import { prisma, SupportStatus } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  status: z.enum(["OPEN", "RESOLVED"]).optional(),
  adminNote: z.string().trim().max(2000).nullish(),
});

// PATCH /api/admin/support/:id — mark handled, or leave a note for the team.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "support");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const existing = await prisma.supportMessage.findUnique({ where: { id } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "Message not found.", requestId);

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid input.",
      requestId,
    );
  }
  const d = parsed.data;

  const updated = await prisma.supportMessage.update({
    where: { id },
    data: {
      ...(d.status !== undefined
        ? {
            status: d.status as SupportStatus,
            // Stamped only on the transition, so reopening clears it.
            resolvedAt: d.status === "RESOLVED" ? new Date() : null,
          }
        : {}),
      ...(d.adminNote !== undefined ? { adminNote: d.adminNote || null } : {}),
    },
  });

  await writeAudit({
    actorId: guard.session.user.id,
    action: "update",
    targetType: "SupportMessage",
    targetId: id,
    metadata: { status: updated.status },
  });

  return NextResponse.json(
    { id: updated.id, status: updated.status },
    { headers: { "x-request-id": requestId } },
  );
}
