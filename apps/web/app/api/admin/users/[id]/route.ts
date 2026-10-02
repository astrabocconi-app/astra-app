import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { deleteOwnAccount, AccountDeletionError } from "@/lib/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/admin/users/:id — delete a student's account from the backoffice.
// Same anonymisation as in-app deletion (see lib/account.ts); admin only.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  if (id === guard.session.user.id) {
    return errorResponse(400, "BAD_REQUEST", "You can't delete your own account here.", requestId);
  }
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { roles: true } });
  if (!user) return errorResponse(404, "NOT_FOUND", "Account not found.", requestId);
  if (user.roles.includes("ADMIN")) {
    return errorResponse(400, "BAD_REQUEST", "Admin accounts can't be deleted from here.", requestId);
  }

  try {
    const { removed } = await deleteOwnAccount(id);
    await writeAudit({
      actorId: guard.session.user.id,
      action: "user.delete",
      targetType: "User",
      targetId: id,
      metadata: { removed },
    });
    return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    if (err instanceof AccountDeletionError) {
      return errorResponse(400, "BAD_REQUEST", err.message, requestId);
    }
    throw err;
  }
}
