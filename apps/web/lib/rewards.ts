// Reward redemption. SERVER-ONLY.
//
// Redeeming moves three things that must agree: the student's points, the
// reward's remaining stock, and a single-use voucher out of the pool. They all
// happen inside one Serializable transaction, so a student double-tapping —
// or two students racing for the last ticket — can't overdraw points, take
// stock that isn't there, or be handed the same Eventbrite code twice.

import { prisma, Prisma, LedgerSource, RedemptionStatus } from "@astra/db";
import { pickupRef } from "./redemptions";
import { emailHash } from "./email-hash";
import { isWriteConflict } from "./tx";

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
export class PerUserLimitError extends Error {
  constructor(public limit: number) {
    super(
      limit === 1
        ? "You've already redeemed this reward."
        : `You've already redeemed this reward ${limit} times.`,
    );
    this.name = "PerUserLimitError";
  }
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

export async function redeemReward(
  userId: string,
  rewardId: string,
  /** The app's Idempotency-Key: a retry after a dropped response replays, not recharges. */
  idempotencyKey?: string | null,
): Promise<RedeemResult> {
  const key = idempotencyKey?.trim() || null;
  if (key) {
    const replay = await findReplay(userId, rewardId, key);
    if (replay) return replay;
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptRedeem(userId, rewardId, key);
    } catch (e) {
      // Two requests with the same key raced: the other one won, return its result.
      if (key && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const replay = await findReplay(userId, rewardId, key);
        if (replay) return replay;
      }
      if (!isWriteConflict(e) || attempt === MAX_ATTEMPTS) throw e;
      // Back off a little, with jitter, so retries don't collide again.
      await new Promise((r) => setTimeout(r, attempt * 25 + Math.floor(Math.random() * 25)));
    }
  }
  throw new RedeemBusyError();
}

async function findReplay(userId: string, rewardId: string, key: string): Promise<RedeemResult | null> {
  const row = await prisma.rewardRedemption.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
  });
  if (!row || row.rewardId !== rewardId) return null;
  const rows = await prisma.$queryRaw<{ balance: bigint }[]>`
    SELECT COALESCE(SUM("delta"), 0)::bigint AS balance
    FROM "PointsLedgerEntry"
    WHERE "userId" = ${userId} AND "kind" = 'POINTS'::"PointsKind"`;
  return {
    redemptionId: row.id,
    code: row.code,
    status: row.status,
    costPoints: row.costPoints,
    balance: Number(rows[0]?.balance ?? 0),
  };
}

async function attemptRedeem(userId: string, rewardId: string, idempotencyKey: string | null): Promise<RedeemResult> {
  return prisma.$transaction(
    async (tx) => {
      const reward = await tx.reward.findFirst({
        where: { id: rewardId, active: true, deletedAt: null },
      });
      if (!reward) throw new RewardUnavailableError();

      // Per-person cap. Counted inside the Serializable transaction so a
      // student firing several redeems at once can't slip past it — the same
      // reason stock uses a conditional update rather than read-then-write.
      // A cancelled (refunded) redemption does not use the allowance up, and
      // redemptions made under an earlier, since-deleted account of the same
      // person (same email hash) count: deleting and re-registering must not
      // reset the limit.
      if (reward.perUserLimit !== null) {
        const me = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
        const mine = await tx.rewardRedemption.count({
          where: {
            rewardId,
            status: { not: RedemptionStatus.CANCELLED },
            user: me ? { OR: [{ id: userId }, { emailHash: emailHash(me.email) }] } : { id: userId },
          },
        });
        if (mine >= reward.perUserLimit) {
          throw new PerUserLimitError(reward.perUserLimit);
        }
      }

      // Balance is derived from the append-only ledger, never a stored column.
      const rows = await tx.$queryRaw<{ balance: bigint }[]>`
        SELECT COALESCE(SUM("delta"), 0)::bigint AS balance
        FROM "PointsLedgerEntry"
        WHERE "userId" = ${userId} AND "kind" = 'POINTS'::"PointsKind"`;
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
          idempotencyKey,
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

export const REDEMPTIONS_PAGE_SIZE = 50;

/** A student's own redemptions, newest first — the "your vouchers" list, one page at a time. */
export async function listRedemptions(
  userId: string,
  opts: { limit?: number; cursor?: string | null } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? REDEMPTIONS_PAGE_SIZE, 1), 100);
  const rows = await prisma.rewardRedemption.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: { reward: { select: { title: true } } },
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      // Short reference the student reads out at the desk; the backoffice shows
      // the same one, derived from the id rather than stored.
      pickupRef: pickupRef(r.id),
      rewardId: r.rewardId,
      rewardTitle: r.reward.title,
      costPoints: r.costPoints,
      status: r.status,
      code: r.code,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
  };
}

/** How many vouchers a reward still has — surfaced in the dashboard. */
export async function codeCounts(rewardId: string) {
  const [total, available] = await Promise.all([
    prisma.rewardCode.count({ where: { rewardId } }),
    prisma.rewardCode.count({ where: { rewardId, claimedAt: null } }),
  ]);
  return { total, available };
}
