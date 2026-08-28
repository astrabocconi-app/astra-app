import { NextResponse } from "next/server";
import { prisma, Role } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rolesInput = z.object({
  roles: z.array(z.enum(Object.values(Role) as [string, ...string[]])).min(1, "Pick at least one role"),
});

// PATCH /api/admin/users/:id — set a user's roles.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const parsed = rolesInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const roles = parsed.data.roles as Role[];

  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return errorResponse(404, "NOT_FOUND", "User not found.", requestId);

  // Lockout guard: an admin must not be able to strip their own ADMIN role and
  // leave nobody able to get back in.
  if (id === guard.session.user.id && !roles.includes(Role.ADMIN)) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      "You can't remove your own admin role — ask another admin to do it.",
      requestId,
    );
  }
  // Same guard at the account level: never drop below one admin.
  if (existing.roles.includes(Role.ADMIN) && !roles.includes(Role.ADMIN)) {
    const otherAdmins = await prisma.user.count({
      where: { id: { not: id }, deletedAt: null, roles: { has: Role.ADMIN } },
    });
    if (otherAdmins === 0) {
      return errorResponse(400, "BAD_REQUEST", "This is the last admin — promote someone else first.", requestId);
    }
  }

  const updated = await prisma.user.update({ where: { id }, data: { roles: { set: roles } } });
  await writeAudit({
    actorId: guard.session.user.id,
    action: "update",
    targetType: "User",
    targetId: id,
    metadata: { name: updated.email, roles },
  });
  return NextResponse.json(
    { id: updated.id, roles: updated.roles },
    { headers: { "x-request-id": requestId } },
  );
}
