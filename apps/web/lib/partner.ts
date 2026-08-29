// Partner-venue helpers. SERVER-ONLY.
//
// Partner accounts sign in with a login code + password (issued by ASTRA, not
// self-set). Passwords are scrypt-hashed. A partner scans a student's card QR
// to award points; scans are recorded as ledger entries (source PARTNER_SCAN)
// stamped with the venue (refType/refId) for reporting and with grantedById =
// the specific login that made them, for traceability.

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

/**
 * How long a student must wait before the same perk counts again.
 *
 * Enforced per (student, offer) — the venue's promotion is what's being used,
 * so a student can take the lunch deal and the evening deal in the same hour,
 * but not the same one twice. Scans with no offer fall back to per-venue.
 */
export const SCAN_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Has this student already used this perk inside the cooldown?
 *
 * Server-side on purpose: a client-side guard only stops accidental
 * double-taps. It can't survive the card QR rotating (a new token looks like a
 * new code), a second staff phone scanning the same student, or a client that
 * simply doesn't cooperate. Returns when the next scan becomes allowed.
 */
export async function findRecentScan(params: {
  studentId: string;
  partnerId: string;
  offerId?: string | null;
}): Promise<{ lastAt: Date; nextAllowedAt: Date } | null> {
  const since = new Date(Date.now() - SCAN_COOLDOWN_MS);
  const previous = await prisma.pointsLedgerEntry.findFirst({
    where: {
      userId: params.studentId,
      source: LedgerSource.PARTNER_SCAN,
      createdAt: { gte: since },
      // Same promotion when one was chosen; otherwise same venue.
      ...(params.offerId
        ? { offerId: params.offerId }
        : { refType: "Partner", refId: params.partnerId, offerId: null }),
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!previous) return null;
  return {
    lastAt: previous.createdAt,
    nextAllowedAt: new Date(previous.createdAt.getTime() + SCAN_COOLDOWN_MS),
  };
}

/** Award a scan to a student on behalf of a partner. Returns the new balance. */
export async function awardScan(params: {
  studentId: string;
  partnerUserId: string;
  partnerId: string;
  partnerName: string;
  /** Which promotion the scan was for, when the venue runs more than one. */
  offerId?: string | null;
  offerTitle?: string | null;
}): Promise<number> {
  await earn(params.studentId, POINTS_PER_SCAN, {
    source: LedgerSource.PARTNER_SCAN,
    // Name the offer in the reason so the student's own history reads usefully
    // ("Scanned at Casa di Michele · 20% off any coffee").
    reason: params.offerTitle
      ? `Scanned at ${params.partnerName} · ${params.offerTitle}`
      : `Scanned at ${params.partnerName}`,
    refType: "Partner",
    refId: params.partnerId,
    offerId: params.offerId ?? null,
    grantedById: params.partnerUserId,
  });
  return getBalance(params.studentId);
}

/** Ranges the venue analytics can be viewed over. */
export const STATS_RANGES = [7, 14, 30, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

/**
 * Scan tallies for a whole venue, bucketed for charting.
 *
 * Covers every login the venue has, not just the one asking: a manager needs
 * the till's and the bar's scans too, and a per-account total would badly
 * understate the venue.
 *
 * Buckets by day for short ranges and by week beyond a fortnight, so the chart
 * always has roughly 7-13 columns — 90 daily bars on a phone is unreadable.
 */
export async function partnerStats(partnerId: string, days: number = 7) {
  const range: number = (STATS_RANGES as readonly number[]).includes(days) ? days : 7;
  const unit: "day" | "week" = range <= 14 ? "day" : "week";

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (range - 1));

  const where = {
    source: LedgerSource.PARTNER_SCAN,
    refType: "Partner",
    refId: partnerId,
  } as const;

  const [rows, scansTotal, scansToday, todaySum, offers] = await Promise.all([
    // One pass for the whole grid: bucket × offer.
    prisma.$queryRaw<{ bucket: Date; offerId: string | null; n: number }[]>`
      SELECT date_trunc(${unit}::text, "createdAt")::date AS bucket,
             "offerId",
             count(*)::int AS n
      FROM "PointsLedgerEntry"
      WHERE "refType" = 'Partner'
        AND "refId" = ${partnerId}
        AND source = 'PARTNER_SCAN'
        AND "createdAt" >= ${since}
      GROUP BY bucket, "offerId"
    `,
    prisma.pointsLedgerEntry.count({ where }),
    prisma.pointsLedgerEntry.count({ where: { ...where, createdAt: { gte: start } } }),
    prisma.pointsLedgerEntry.aggregate({
      _sum: { delta: true },
      where: { ...where, createdAt: { gte: start } },
    }),
    prisma.offer.findMany({
      where: { partnerId, deletedAt: null },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Every bucket in the window, so quiet periods read as zero rather than
  // vanishing and compressing the axis.
  const buckets: string[] = [];
  const cursor = new Date(since);
  if (unit === "week") {
    // Postgres truncates weeks to Monday; match it so keys line up.
    const weekday = (cursor.getUTCDay() + 6) % 7;
    cursor.setUTCDate(cursor.getUTCDate() - weekday);
  }
  const last = new Date();
  while (cursor <= last) {
    buckets.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + (unit === "week" ? 7 : 1));
  }

  const key = (offerId: string | null, bucket: string) => `${offerId ?? "-"}|${bucket}`;
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(key(r.offerId, new Date(r.bucket).toISOString().slice(0, 10)), Number(r.n));
  }

  const seriesFor = (offerId: string | null, title: string) => ({
    offerId,
    title,
    counts: buckets.map((b) => counts.get(key(offerId, b)) ?? 0),
    total: buckets.reduce((n, b) => n + (counts.get(key(offerId, b)) ?? 0), 0),
  });

  const offerSeries = offers.map((o) => seriesFor(o.id, o.title));
  const unattributedSeries = seriesFor(null, "");
  const series = [
    ...offerSeries,
    // Only surface the catch-all when it actually has scans in this window.
    ...(unattributedSeries.total > 0 ? [unattributedSeries] : []),
  ];

  const scansInRange = series.reduce((n, s) => n + s.total, 0);

  return {
    range: { days: range, bucket: unit },
    buckets,
    series,
    scansTotal,
    scansToday,
    scansInRange,
    pointsToday: todaySum._sum.delta ?? 0,
    // Kept for the existing summary list beneath the chart.
    perOffer: offerSeries.map((s) => ({ offerId: s.offerId as string, title: s.title, scans: s.total })),
    unattributed: unattributedSeries.total,
  };
}
