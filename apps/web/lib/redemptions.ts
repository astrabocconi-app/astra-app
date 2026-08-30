// Fulfilling reward redemptions from the backoffice. SERVER-ONLY.
//
// A reward with a voucher pool fulfils itself: the student gets a code the
// instant they redeem. Everything else — a tote bag, a hoodie, a free ticket
// handed over in person — lands as PENDING and needs a human to say "collected".
// Without this, those redemptions sat in PENDING forever: the points were gone,
// the student saw "awaiting fulfilment", and nobody could change it.

import { prisma, Prisma, LedgerSource, RedemptionStatus } from "@astra/db";

export class RedemptionError extends Error {}

/**
 * A short reference the student can read out at the desk.
 *
 * Derived from the id rather than stored: a new column would need a migration
 * and a backfill for redemptions that already exist, and the tail of a cuid is
 * already unique enough to find one row among a few hundred.
 */
export function pickupRef(id: string): string {
  return id.slice(-6).toUpperCase();
}

export interface RedemptionFilter {
  status?: RedemptionStatus;
  /** Matches student name, email, reward title, or the pickup reference. */
  query?: string;
  take?: number;
}

export async function listRedemptions(filter: RedemptionFilter = {}) {
  const q = filter.query?.trim();
  const rows = await prisma.rewardRedemption.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(q
        ? {
            OR: [
              { user: { name: { contains: q, mode: "insensitive" as const } } },
              { user: { email: { contains: q, mode: "insensitive" as const } } },
              { reward: { title: { contains: q, mode: "insensitive" as const } } },
              // The pickup reference is the tail of the id, so match on that.
              { id: { endsWith: q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: filter.take ?? 200,
    include: {
      user: { select: { id: true, name: true, email: true, deletedAt: true } },
      reward: { select: { title: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    // NOT named `ref`: React reserves that, and this object is spread
    // straight into a component.
    pickupRef: pickupRef(r.id),
    status: r.status,
    costPoints: r.costPoints,
    // A code means it fulfilled itself; no code means someone hands it over.
    code: r.code,
    createdAt: r.createdAt.toISOString(),
    fulfilledAt: r.fulfilledAt ? r.fulfilledAt.toISOString() : null,
    rewardTitle: r.reward.title,
    student: {
      name: r.user.name,
      // A deleted account keeps its redemption history but loses its address.
      email: r.user.deletedAt ? null : r.user.email,
    },
  }));
}

export async function countByStatus(): Promise<Record<string, number>> {
  const rows = await prisma.rewardRedemption.groupBy({ by: ["status"], _count: true });
  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

/** Mark a redemption collected. Idempotent. */
export async function fulfilRedemption(id: string) {
  const row = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!row) throw new RedemptionError("Redemption not found.");
  if (row.status === RedemptionStatus.FULFILLED) return row;
  if (row.status === RedemptionStatus.CANCELLED) {
    throw new RedemptionError("This was cancelled and refunded. Reopening would need a new redemption.");
  }
  return prisma.rewardRedemption.update({
    where: { id },
    data: { status: RedemptionStatus.FULFILLED, fulfilledAt: new Date() },
  });
}

/**
 * Cancel a redemption and give the points back.
 *
 * The refund is a compensating ledger entry, not a deletion: PointsLedgerEntry
 * is append-only at the database level, and the history should say what
 * happened rather than pretend it never did.
 *
 * Runs in one transaction, and re-reads the row inside it, so two admins
 * clicking Cancel at the same moment cannot refund the same redemption twice.
 * Stock is handed back too, otherwise cancelling would quietly destroy a unit.
 */
export async function cancelRedemption(id: string, actorId: string) {
  return prisma.$transaction(
    async (tx) => {
      const row = await tx.rewardRedemption.findUnique({
        where: { id },
        include: { reward: { select: { title: true, stock: true } } },
      });
      if (!row) throw new RedemptionError("Redemption not found.");
      if (row.status === RedemptionStatus.CANCELLED) {
        // Already refunded; do nothing rather than pay out again.
        return { alreadyCancelled: true, refunded: 0 };
      }

      await tx.rewardRedemption.update({
        where: { id },
        data: { status: RedemptionStatus.CANCELLED, fulfilledAt: null },
      });

      await tx.pointsLedgerEntry.create({
        data: {
          userId: row.userId,
          delta: row.costPoints,
          source: LedgerSource.ADMIN_ADJUSTMENT,
          reason: `Refund: ${row.reward.title}`,
          refType: "Reward",
          refId: row.rewardId,
          grantedById: actorId,
        },
      });

      // Only rewards that track stock get a unit back.
      if (row.reward.stock !== null) {
        await tx.reward.update({
          where: { id: row.rewardId },
          data: { stock: { increment: 1 } },
        });
      }

      // A voucher that was never handed over goes back in the pool. One that
      // the student already has is left claimed — recycling it would hand the
      // same code to someone else.
      if (!row.code) {
        await tx.rewardCode.updateMany({
          where: { redemptionId: id },
          data: { claimedAt: null, redemptionId: null },
        });
      }

      return { alreadyCancelled: false, refunded: row.costPoints };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
