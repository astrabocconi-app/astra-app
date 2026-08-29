import { NextResponse } from "next/server";
import { prisma, LedgerSource } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { earn, spend, getBalance, InsufficientPointsError } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const adjustInput = z.object({
  email: z.string().trim().email("Enter a valid email"),
  // Signed: positive grants, negative deducts. Zero is meaningless.
  delta: z.coerce.number().int().refine((n) => n !== 0, "Amount can't be zero"),
  reason: z.string().trim().min(1, "Reason is required"),
});

// POST /api/admin/points — manually grant or deduct a student's points.
// Goes through the same append-only ledger as every other award, so balances
// stay derived and the adjustment shows up in the student's history.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const parsed = adjustInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const { email, delta, reason } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    select: { id: true, email: true },
  });
  if (!user) return errorResponse(404, "NOT_FOUND", `No user with the email ${email}.`, requestId);

  try {
    if (delta > 0) {
      await earn(user.id, delta, {
        source: LedgerSource.ADMIN_ADJUSTMENT,
        reason,
        grantedById: guard.session.user.id,
      });
    } else {
      await spend(user.id, Math.abs(delta), {
        source: LedgerSource.ADMIN_ADJUSTMENT,
        reason,
        grantedById: guard.session.user.id,
      });
    }
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      return errorResponse(
        400,
        "INSUFFICIENT_POINTS",
        `${email} only has ${e.balance} points — can't deduct ${e.requested}.`,
        requestId,
      );
    }
    throw e;
  }

  const balance = await getBalance(user.id);
  await writeAudit({
    actorId: guard.session.user.id,
    action: "update",
    targetType: "Points",
    targetId: user.id,
    metadata: { name: user.email, reason, delta, balance },
  });

  return NextResponse.json(
    { ok: true, email: user.email, delta, balance },
    { headers: { "x-request-id": requestId } },
  );
}
