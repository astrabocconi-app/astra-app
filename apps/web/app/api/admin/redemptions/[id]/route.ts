import { NextResponse } from "next/server";
import { z } from "zod";
import { newRequestId, errorResponse, log } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { fulfilRedemption, cancelRedemption, RedemptionError } from "@/lib/redemptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ action: z.enum(["fulfil", "cancel"]) });

// PATCH /api/admin/redemptions/:id — mark collected, or cancel and refund.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "redemptions");
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", "Unknown action.", requestId);
  }

  try {
    if (parsed.data.action === "fulfil") {
      const row = await fulfilRedemption(id);
      await writeAudit({
        actorId: guard.session.user.id,
        action: "update",
        targetType: "RewardRedemption",
        targetId: id,
        metadata: { status: "FULFILLED" },
      });
      log("info", requestId, "redemption fulfilled", { id });
      return NextResponse.json(
        { status: row.status },
        { headers: { "x-request-id": requestId } },
      );
    }

    const result = await cancelRedemption(id, guard.session.user.id);
    await writeAudit({
      actorId: guard.session.user.id,
      action: "update",
      targetType: "RewardRedemption",
      targetId: id,
      metadata: { status: "CANCELLED", refunded: result.refunded },
    });
    log("info", requestId, "redemption cancelled", { id, refunded: result.refunded });
    return NextResponse.json(
      {
        status: "CANCELLED",
        refunded: result.refunded,
        alreadyCancelled: result.alreadyCancelled,
      },
      { headers: { "x-request-id": requestId } },
    );
  } catch (e) {
    if (e instanceof RedemptionError) {
      return errorResponse(400, "CANNOT_UPDATE", e.message, requestId);
    }
    throw e;
  }
}
