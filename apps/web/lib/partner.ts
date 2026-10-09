// Partner-venue helpers. SERVER-ONLY.
//
// Partner accounts sign in with a login code + password (issued by ASTRA, not
// self-set). Passwords are scrypt-hashed. A partner scans a student's card QR
// to award points; scans are recorded as ledger entries (source PARTNER_SCAN)
// stamped with the venue (refType/refId) for reporting and with grantedById =
// the specific login that made them, for traceability.

import { prisma, Prisma, LedgerSource } from "@astra/db";
import { getBalance } from "./points";
import { bucketKeys, romeDateKey, startOfRomeDay, startOfRomeDayKey, addDaysToKey } from "./rome-time";

// Fixed award per scan for now; per-offer / per-venue values come later.
export const POINTS_PER_SCAN = 10;

/**
 * The partner membership for a user (with the venue), or null for non-partners.
 *
 * Also null when the venue was deleted or hidden, or the login's user was
 * revoked: ending a partnership must end its staff's power to award points, not
 * just remove the venue from the map.
 */
export async function getPartnerForUser(userId: string) {
  return prisma.partnerMembership.findFirst({
    where: {
      userId,
      user: { deletedAt: null },
      partner: { deletedAt: null, active: true },
    },
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

/** The scanned card does not belong to a live student account. */
export class NotAStudentError extends Error {
  constructor() {
    super("That card doesn't belong to a student.");
    this.name = "NotAStudentError";
  }
}

/** Raised when the cooldown blocks a scan. Carries when it lifts. */
export class ScanTooSoonError extends Error {
  constructor(
    readonly lastAt: Date,
    readonly nextAllowedAt: Date,
  ) {
    super("This perk was already used inside the cooldown.");
    this.name = "ScanTooSoonError";
  }
}

/**
 * Check the cooldown and award, atomically.
 *
 * Doing this as a read followed by a write let two concurrent requests both see
 * "no recent scan" and both award — a double-tap, a retry on a flaky connection,
 * or a second staff phone would hand out the points twice for one physical scan.
 * Serializable makes the range read and the insert conflict, so one of them
 * aborts and retries, and on the retry it sees the other's row.
 *
 * Same shape as reward redemption (lib/rewards.ts), for the same reason.
 */
export async function awardScanIfAllowed(params: {
  studentId: string;
  partnerUserId: string;
  partnerId: string;
  partnerName: string;
  offerId?: string | null;
  offerTitle?: string | null;
}): Promise<number> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // Only students earn from a scan: a partner or staff login holding a
          // card QR must not be able to farm points at another venue.
          const student = await tx.user.findFirst({
            where: { id: params.studentId, deletedAt: null, roles: { has: "STUDENT" } },
            select: { id: true },
          });
          if (!student) throw new NotAStudentError();
          const since = new Date(Date.now() - SCAN_COOLDOWN_MS);
          const previous = await tx.pointsLedgerEntry.findFirst({
            where: {
              userId: params.studentId,
              source: LedgerSource.PARTNER_SCAN,
              createdAt: { gte: since },
              ...(params.offerId
                ? { offerId: params.offerId }
                : { refType: "Partner", refId: params.partnerId, offerId: null }),
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });
          if (previous) {
            throw new ScanTooSoonError(
              previous.createdAt,
              new Date(previous.createdAt.getTime() + SCAN_COOLDOWN_MS),
            );
          }
          await tx.pointsLedgerEntry.create({
            data: {
              userId: params.studentId,
              kind: "POINTS",
              delta: POINTS_PER_SCAN,
              source: LedgerSource.PARTNER_SCAN,
              reason: params.offerTitle
                ? `Scanned at ${params.partnerName} · ${params.offerTitle}`
                : `Scanned at ${params.partnerName}`,
              refType: "Partner",
              refId: params.partnerId,
              offerId: params.offerId ?? null,
              grantedById: params.partnerUserId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return getBalance(params.studentId);
    } catch (e) {
      if (e instanceof ScanTooSoonError || e instanceof NotAStudentError) throw e;
      const conflict =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === "P2034" || e.code === "P2028");
      if (!conflict || attempt === MAX_ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, attempt * 25 + Math.floor(Math.random() * 25)));
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new Error("Scan could not be recorded.");
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

  // "Today" and every chart bucket are Milan days, not UTC days.
  const todayKey = romeDateKey();
  const start = startOfRomeDay();
  const sinceKey = addDaysToKey(todayKey, -(range - 1));
  const since = startOfRomeDayKey(unit === "week" ? bucketKeys(sinceKey, todayKey, "week")[0]! : sinceKey);

  const where = {
    source: LedgerSource.PARTNER_SCAN,
    refType: "Partner",
    refId: partnerId,
  } as const;

  const [rows, scansTotal, scansToday, todaySum, offers] = await Promise.all([
    // One pass for the whole grid: bucket × offer.
    prisma.$queryRaw<{ bucket: string; offerId: string | null; n: number }[]>`
      SELECT to_char(date_trunc(${unit}::text, ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Rome'), 'YYYY-MM-DD') AS bucket,
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
  // vanishing and compressing the axis. Weeks start on Monday, like Postgres.
  const buckets = bucketKeys(sinceKey, todayKey, unit);

  const key = (offerId: string | null, bucket: string) => `${offerId ?? "-"}|${bucket}`;
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(key(r.offerId, r.bucket), Number(r.n));
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
