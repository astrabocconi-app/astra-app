import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import {
  setStaffName,
  setStaffPages,
  setStaffPassword,
  revokeStaffAccount,
  StaffAccountError,
} from "@/lib/staff-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/staff/:id — change the page list, the password, or the name.
// Each field is optional; anything omitted is left alone.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    pages?: unknown;
    password?: unknown;
    name?: unknown;
  } | null;
  if (!body) return errorResponse(400, "BAD_REQUEST", "Invalid input.", requestId);

  try {
    const changed: Record<string, unknown> = {};

    if (body.pages !== undefined) {
      changed.pages = await setStaffPages(id, body.pages);
    }
    if (typeof body.name === "string") {
      await setStaffName(id, body.name);
      changed.name = body.name;
    }
    if (typeof body.password === "string" && body.password.length > 0) {
      await setStaffPassword(id, body.password);
      // Recorded as a fact, without the value.
      changed.passwordReset = true;
    }

    await writeAudit({
      actorId: guard.session.user.id,
      action: "staff.update",
      targetType: "User",
      targetId: id,
      metadata: changed,
    });

    return NextResponse.json({ ok: true, ...changed }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    if (err instanceof StaffAccountError) {
      return errorResponse(400, "BAD_REQUEST", err.message, requestId);
    }
    throw err;
  }
}

// DELETE /api/admin/staff/:id — revoke the account. See revokeStaffAccount for
// why the row survives.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  try {
    await revokeStaffAccount(id);
    await writeAudit({
      actorId: guard.session.user.id,
      action: "staff.revoke",
      targetType: "User",
      targetId: id,
    });
    return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    if (err instanceof StaffAccountError) {
      return errorResponse(400, "BAD_REQUEST", err.message, requestId);
    }
    throw err;
  }
}
