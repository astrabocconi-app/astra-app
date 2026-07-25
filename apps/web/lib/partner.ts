// Partner-venue helpers. SERVER-ONLY.
//
// Partner accounts sign in with a login code + password (issued by ASTRA, not
// self-set). Passwords are scrypt-hashed. A partner scans a student's card QR
// to award points; scans are recorded as ledger entries (source PARTNER_SCAN)
// with grantedById = the partner account, which is how we tally per-venue.

import crypto from "node:crypto";
import { prisma, LedgerSource } from "@astra/db";
import { earn, getBalance } from "./points";

// Fixed award per scan for now; per-offer / per-venue values come later.
export const POINTS_PER_SCAN = 10;

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const known = Buffer.from(hash, "hex");
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

/** The partner membership for a user (with the venue), or null for non-partners. */
export async function getPartnerForUser(userId: string) {
  return prisma.partnerMembership.findUnique({
    where: { userId },
    include: { partner: true },
  });
}

/** Award a scan to a student on behalf of a partner. Returns the new balance. */
export async function awardScan(params: {
  studentId: string;
  partnerUserId: string;
  partnerId: string;
  partnerName: string;
}): Promise<number> {
  await earn(params.studentId, POINTS_PER_SCAN, {
    source: LedgerSource.PARTNER_SCAN,
    reason: `Scanned at ${params.partnerName}`,
    refType: "Partner",
    refId: params.partnerId,
    grantedById: params.partnerUserId,
  });
  return getBalance(params.studentId);
}

/** Per-venue scan tallies for the partner dashboard/home. */
export async function partnerStats(partnerUserId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const where = { grantedById: partnerUserId, source: LedgerSource.PARTNER_SCAN } as const;

  // Per-day scan counts over the last 7 calendar days (for the home line chart).
  const rows = await prisma.$queryRaw<{ day: Date; n: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
    FROM "PointsLedgerEntry"
    WHERE "grantedById" = ${partnerUserId}
      AND source = 'PARTNER_SCAN'
      AND "createdAt" >= (CURRENT_DATE - INTERVAL '6 days')
    GROUP BY day
  `;
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(new Date(r.day).toISOString().slice(0, 10), Number(r.n));
  const scansByDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    scansByDay.push({ date: key, count: byDay.get(key) ?? 0 });
  }

  const [scansTotal, scansToday, todaySum] = await Promise.all([
    prisma.pointsLedgerEntry.count({ where }),
    prisma.pointsLedgerEntry.count({ where: { ...where, createdAt: { gte: start } } }),
    prisma.pointsLedgerEntry.aggregate({
      _sum: { delta: true },
      where: { ...where, createdAt: { gte: start } },
    }),
  ]);
  return { scansTotal, scansToday, pointsToday: todaySum._sum.delta ?? 0, scansByDay };
}
