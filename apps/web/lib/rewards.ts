// Reward redemption. SERVER-ONLY.
//
// Redeeming moves three things that must agree: the student's points, the
// reward's remaining stock, and a single-use voucher out of the pool. They all
// happen inside one Serializable transaction, so a student double-tapping —
// or two students racing for the last ticket — can't overdraw points, take
// stock that isn't there, or be handed the same Eventbrite code twice.

import { prisma, Prisma, LedgerSource, RedemptionStatus } from "@astra/db";

export class InsufficientPointsError extends Error {
  constructor(
    public balance: number,
    public required: number,
  ) {
    super(`Insufficient points: balance ${balance}, required ${required}`);
    this.name = "InsufficientPointsError";
  }
}
export class OutOfStockError extends Error {
  constructor() {
    super("This reward is out of stock.");
    this.name = "OutOfStockError";
  }
}
export class RewardUnavailableError extends Error {
  constructor(message = "This reward isn't available.") {
    super(message);
    this.name = "RewardUnavailableError";
  }
}
export class RedeemBusyError extends Error {
  constructor() {
    super("Too many people are redeeming at once. Please try again.");
    this.name = "RedeemBusyError";
  }
}

/**
 * Serializable transactions legitimately abort when two of them touch the same
 * rows — Postgres reports a write conflict and expects the caller to retry.
 * Without this, two students redeeming the same reward at the same instant both
 * got an opaque 500 even though the data was fine.
 */
function isWriteConflict(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2034" || e.code === "P2028")
  );
}

const MAX_ATTEMPTS = 5;

export interface RedeemResult {
  redemptionId: string;
  /** The voucher handed out, when the reward has a code pool. */
  code: string | null;
  status: RedemptionStatus;
  costPoints: number;
  balance: number;
}

export async function redeemReward(userId: string, rewardId: string): Promise<RedeemResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptRedeem(userId, rewardId);
    } catch (e) {
      if (!isWriteConflict(e) || attempt === MAX_ATTEMPTS) throw e;
      // Back off a little, with jitter, so retries don't collide again.
      await new Promise((r) => setTimeout(r, attempt * 25 + Math.floor(Math.random() * 25)));
    }
  }
  throw new RedeemBusyError();
}

async function attemptRedeem(userId: string, rewardId: string): Promise<RedeemResult> {
  return prisma.$transaction(
    async (tx) => {
      const reward = await tx.reward.findFirst({
        where: { id: rewardId, active: true, deletedAt: null },
      });
      if (!reward) throw new RewardUnavailableError();

      // Balance is derived from the append-only ledger, never a stored column.
      const rows = await tx.$queryRaw<{ balance: bigint }[]>`
        SELECT COALESCE(SUM("delta"), 0)::bigint AS balance
        FROM "PointsLedgerEntry"
        WHERE "userId" = ${userId} AND "kind"::text = 'POINTS'`;
      const balance = Number(rows[0]?.balance ?? 0);
      if (balance < reward.costPoints) {
        throw new InsufficientPointsError(balance, reward.costPoints);
      }

      // Conditional decrement: if stock is tracked, only succeed while some is
      // left. A plain read-then-write would let two redemptions pass the check.
      if (reward.stock !== null) {
        const taken = await tx.reward.updateMany({
          where: { id: rewardId, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (taken.count === 0) throw new OutOfStockError();
      }

      const spend = await tx.pointsLedgerEntry.create({
        data: {
          userId,
          delta: -reward.costPoints,
          source: LedgerSource.REWARD_REDEMPTION,
          reason: `Redeemed: ${reward.title}`,
          refType: "Reward",
          refId: reward.id,
        },
      });

      // Take one unclaimed voucher. SKIP LOCKED means concurrent redemptions
      // pick different rows instead of queueing behind each other.
      const claimed = await tx.$queryRaw<{ id: string; code: string }[]>`
        UPDATE "RewardCode"
        SET "claimedAt" = now()
        WHERE "id" = (
          SELECT "id" FROM "RewardCode"
          WHERE "rewardId" = ${rewardId} AND "claimedAt" IS NULL
          ORDER BY "createdAt"
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING "id", "code"`;
      const voucher = claimed[0] ?? null;

      const redemption = await tx.rewardRedemption.create({
        data: {
          userId,
          rewardId,
          costPoints: reward.costPoints,
          // A voucher is immediately usable; without one, staff fulfil by hand.
          status: voucher ? RedemptionStatus.FULFILLED : RedemptionStatus.PENDING,
          fulfilledAt: voucher ? new Date() : null,
          code: voucher?.code ?? null,
          ledgerEntryId: spend.id,
        },
      });

      if (voucher) {
        await tx.rewardCode.update({
          where: { id: voucher.id },
          data: { redemptionId: redemption.id },
        });
      }

      return {
        redemptionId: redemption.id,
        code: voucher?.code ?? null,
        status: redemption.status,
        costPoints: reward.costPoints,
        balance: balance - reward.costPoints,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** A student's own redemptions, newest first — the "your vouchers" list. */
export async function listRedemptions(userId: string) {
  const rows = await prisma.rewardRedemption.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { reward: { select: { title: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    rewardTitle: r.reward.title,
    costPoints: r.costPoints,
    status: r.status,
    code: r.code,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** How many vouchers a reward still has — surfaced in the dashboard. */
export async function codeCounts(rewardId: string) {
  const [total, available] = await Promise.all([
    prisma.rewardCode.count({ where: { rewardId } }),
    prisma.rewardCode.count({ where: { rewardId, claimedAt: null } }),
  ]);
  return { total, available };
}
