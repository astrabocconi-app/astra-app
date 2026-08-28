import { NextResponse } from "next/server";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { updatePartnerAccount, deletePartnerAccount } from "@/lib/partner-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchInput = z.object({
  loginCode: z.string().trim().min(3, "Login code must be at least 3 characters").optional(),
  // Omitted or blank means "leave the current password alone".
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  label: z.string().trim().nullish(),
  scanOnly: z.boolean().optional(),
});

// PATCH /api/admin/partner-accounts/:id — rename, reset password, or switch
// between scan-only and full access.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const parsed = patchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }

  try {
    const updated = await updatePartnerAccount(id, parsed.data);
    await writeAudit({
      actorId: guard.session.user.id,
      action: "update",
      targetType: "PartnerAccount",
      targetId: id,
      metadata: {
        name: `${updated.partner.name} · ${updated.loginCode}`,
        scanOnly: updated.scanOnly,
        passwordChanged: Boolean(parsed.data.password),
      },
    });
    return NextResponse.json(
      { id: updated.id, loginCode: updated.loginCode, scanOnly: updated.scanOnly },
      { headers: { "x-request-id": requestId } },
    );
  } catch (e) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      e instanceof Error ? e.message : "Couldn't update the account.",
      requestId,
    );
  }
}

// DELETE /api/admin/partner-accounts/:id — revoke a login.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  try {
    await deletePartnerAccount(id);
    await writeAudit({
      actorId: guard.session.user.id,
      action: "delete",
      targetType: "PartnerAccount",
      targetId: id,
    });
    return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      e instanceof Error ? e.message : "Couldn't delete the account.",
      requestId,
    );
  }
}
