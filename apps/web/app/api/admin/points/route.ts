import { NextResponse } from "next/server";
import { prisma, LedgerSource } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { earn, spend, getBalance, InsufficientPointsError } from "@/lib/points";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Largest single manual adjustment. The ledger is append-only, so a typo'd
 * 50000 for 500 can only be undone with a second entry, and a staff account with
 * this page must not be able to mint rewards-worth of points in one request.
 */
const MAX_ADJUSTMENT = 10_000;

const adjustInput = z.object({
  email: z.string().trim().email("Enter a valid email"),
  // Signed: positive grants, negative deducts. Zero is meaningless.
  delta: z.coerce
    .number()
    .int("Amount must be a whole number")
    .refine((n) => n !== 0, "Amount can't be zero")
    .refine((n) => Math.abs(n) <= MAX_ADJUSTMENT, `Amount can't be more than ${MAX_ADJUSTMENT.toLocaleString("en-GB")} points either way`),
  reason: z.string().trim().min(1, "Reason is required").max(200, "Reason must be 200 characters or fewer"),
});

// POST /api/admin/points — manually grant or deduct a student's points.
// Goes through the same append-only ledger as every other award, so balances
// stay derived and the adjustment shows up in the student's history.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "points");
  if ("error" in guard) return guard.error;

  const parsed = adjustInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const { email, delta, reason } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    select: { id: true, email: true, roles: true },
  });
  if (!user) return errorResponse(404, "NOT_FOUND", `No user with the email ${email}.`, requestId);
  // Points belong to students: venue logins, staff and admins have no business holding them.
  if (!user.roles.includes("STUDENT")) {
    return errorResponse(400, "NOT_A_STUDENT", "Points can only be adjusted for student accounts.", requestId);
  }

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
  // The target is the user id; the address is not repeated here (and would be
  // hashed by writeAudit anyway).
  await writeAudit({
    actorId: guard.session.user.id,
    action: "update",
    targetType: "Points",
    targetId: user.id,
    metadata: { reason, delta, balance },
  });

  return NextResponse.json({ ok: true, email: user.email, delta, balance });
}

export const POST = withApi(handlePost);
