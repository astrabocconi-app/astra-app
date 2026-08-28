// Points engine — the append-only ledger is the source of truth; balances are
// derived (never a mutable column). SERVER-ONLY.
//
//   earn()   → positive ledger entry
//   spend()  → negative ledger entry, atomically rejected if balance too low
//   balance()/history() → read models

import { prisma, Prisma, LedgerSource, type PointsKind } from "@astra/db";

export class InsufficientPointsError extends Error {
  constructor(
    public balance: number,
    public requested: number
  ) {
    super(`Insufficient points: balance ${balance}, requested ${requested}`);
    this.name = "InsufficientPointsError";
  }
}

interface LedgerOpts {
  source?: LedgerSource;
  reason: string;
  refType?: string;
  refId?: string;
  /** Partner offer this entry is attributed to, for per-promotion reporting. */
  offerId?: string | null;
  grantedById?: string;
  kind?: PointsKind;
}

/** Current spendable balance for a user + kind (defaults to POINTS). */
export async function getBalance(userId: string, kind: PointsKind = "POINTS"): Promise<number> {
  const rows = await prisma.$queryRaw<{ balance: bigint }[]>`
    SELECT COALESCE(SUM("delta"), 0)::bigint AS balance
    FROM "PointsLedgerEntry"
    WHERE "userId" = ${userId} AND "kind"::text = ${kind}`;
  return Number(rows[0]?.balance ?? 0);
}

/** Award points. `amount` must be positive. */
export async function earn(userId: string, amount: number, opts: LedgerOpts) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("earn() amount must be a positive integer");
  }
  return prisma.pointsLedgerEntry.create({
    data: {
      userId,
      kind: opts.kind ?? "POINTS",
      delta: amount,
      source: opts.source ?? LedgerSource.OTHER,
      reason: opts.reason,
      refType: opts.refType,
      refId: opts.refId,
      offerId: opts.offerId ?? null,
      grantedById: opts.grantedById,
    },
  });
}

/**
 * Spend points. `amount` positive; recorded as a negative delta. Runs in a
 * Serializable transaction so concurrent spends can't overspend the balance.
 */
export async function spend(userId: string, amount: number, opts: LedgerOpts) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("spend() amount must be a positive integer");
  }
  const kind = opts.kind ?? "POINTS";
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ balance: bigint }[]>`
        SELECT COALESCE(SUM("delta"), 0)::bigint AS balance
        FROM "PointsLedgerEntry"
        WHERE "userId" = ${userId} AND "kind"::text = ${kind}`;
      const balance = Number(rows[0]?.balance ?? 0);
      if (balance < amount) throw new InsufficientPointsError(balance, amount);

      return tx.pointsLedgerEntry.create({
        data: {
          userId,
          kind,
          delta: -amount,
          source: opts.source ?? LedgerSource.REWARD_REDEMPTION,
          reason: opts.reason,
          refType: opts.refType,
          refId: opts.refId,
          grantedById: opts.grantedById,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/** Recent ledger entries for a user, newest first. */
export async function getHistory(userId: string, limit = 50) {
  return prisma.pointsLedgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      delta: true,
      source: true,
      reason: true,
      refType: true,
      refId: true,
      createdAt: true,
    },
  });
}
