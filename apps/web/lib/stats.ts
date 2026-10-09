// Backoffice KPI queries. SERVER-ONLY.
//
// The overview and points pages used to sum the whole ledger, which in production
// includes manual test adjustments of +-10^8 and rows of deleted accounts, so
// "Points issued" read 200 million against about 2,000 real points. These helpers
// count only what students actually earned, for students who still exist.

import { prisma } from "@astra/db";

/** A live student account: not deleted, holds the STUDENT role. */
export const LIVE_STUDENT = { deletedAt: null, roles: { has: "STUDENT" } } as const;

/** Points handed out by the product itself (signup, venue scans, event check-ins) to live students. */
export async function pointsIssued(): Promise<number> {
  const agg = await prisma.pointsLedgerEntry.aggregate({
    _sum: { delta: true },
    where: {
      delta: { gt: 0 },
      source: { in: ["SIGNUP", "PARTNER_SCAN", "EVENT_CHECKIN"] },
      user: LIVE_STUDENT,
    },
  });
  return agg._sum.delta ?? 0;
}

/** Net points held by live students right now. */
export async function pointsInCirculation(): Promise<number> {
  const agg = await prisma.pointsLedgerEntry.aggregate({ _sum: { delta: true }, where: { user: LIVE_STUDENT } });
  return agg._sum.delta ?? 0;
}

/** How many live students hold a positive or negative balance of anything (one count, not a row per holder). */
export async function studentsWithPoints(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(DISTINCT l."userId") AS n
    FROM "PointsLedgerEntry" l JOIN "User" u ON u."id" = l."userId"
    WHERE u."deletedAt" IS NULL AND 'STUDENT' = ANY(u."roles"::text[])`;
  return Number(rows[0]?.n ?? 0);
}

/** Members = live students (not venue logins, staff or admins). */
export async function memberCount(): Promise<number> {
  return prisma.user.count({ where: LIVE_STUDENT });
}
