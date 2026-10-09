import { NextResponse } from "next/server";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
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

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,100}$/;

// POST /api/rewards/:id/redeem — spend points on a reward and, when the reward
// has a voucher pool, hand back a single-use code.
//
// An optional `Idempotency-Key` header makes a retry safe: if the first request
// went through but its response was lost (a 20 s timeout on campus Wi-Fi), the
// same key returns that redemption instead of charging a second time.
async function handlePost(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  if (!session.user.roles.includes("STUDENT")) {
    return errorResponse(403, "FORBIDDEN", "Only students can redeem rewards.", requestId);
  }
  const { id } = await ctx.params;
  const rawKey = req.headers.get("idempotency-key");
  const key = rawKey && IDEMPOTENCY_KEY.test(rawKey) ? rawKey : null;

  try {
    const result = await redeemReward(session.user.id, id, key);
    return NextResponse.json(result);
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

export const POST = withApi(handlePost);
