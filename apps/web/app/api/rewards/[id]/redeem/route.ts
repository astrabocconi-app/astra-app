import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import {
  redeemReward,
  InsufficientPointsError,
  OutOfStockError,
  RewardUnavailableError,
  RedeemBusyError,
  PerUserLimitError,
} from "@/lib/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/rewards/:id/redeem — spend points on a reward and, when the reward
// has a voucher pool, hand back a single-use code.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  const { id } = await ctx.params;

  try {
    const result = await redeemReward(session.user.id, id);
    return NextResponse.json(result, { headers: { "x-request-id": requestId } });
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      return errorResponse(
        400,
        "INSUFFICIENT_POINTS",
        `You need ${e.required - e.balance} more points.`,
        requestId,
      );
    }
    if (e instanceof PerUserLimitError) {
      return errorResponse(409, "PER_USER_LIMIT", e.message, requestId);
    }
    if (e instanceof OutOfStockError) {
      return errorResponse(409, "OUT_OF_STOCK", "This reward has just run out.", requestId);
    }
    if (e instanceof RewardUnavailableError) {
      return errorResponse(404, "NOT_FOUND", e.message, requestId);
    }
    if (e instanceof RedeemBusyError) {
      return errorResponse(503, "BUSY", e.message, requestId);
    }
    throw e;
  }
}
