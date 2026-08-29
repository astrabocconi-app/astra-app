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

/**
 * Scan tallies for a whole venue.
 *
 * Covers every login the venue has, not just the one asking: a manager needs
 * the till's and the bar's scans too, and a per-account total would badly
 * understate the venue.
 */
export async function partnerStats(partnerId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  // Attributed to the VENUE, not to whichever logins currently exist. Keying on
  // the staff accounts meant revoking a login (someone leaves) silently erased
  // their past scans from the venue's totals. Every scan stamps the partner id,
  // so that survives login churn.
  const where = {
    source: LedgerSource.PARTNER_SCAN,
    refType: "Partner",
    refId: partnerId,
  } as const;

  // Per-day scan counts over the last 7 calendar days (for the home line chart).
  const rows = await prisma.$queryRaw<{ day: Date; n: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
    FROM "PointsLedgerEntry"
    WHERE "refType" = 'Partner'
      AND "refId" = ${partnerId}
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

  const [scansTotal, scansToday, todaySum, perOfferRaw, offers] = await Promise.all([
    prisma.pointsLedgerEntry.count({ where }),
    prisma.pointsLedgerEntry.count({ where: { ...where, createdAt: { gte: start } } }),
    prisma.pointsLedgerEntry.aggregate({
      _sum: { delta: true },
      where: { ...where, createdAt: { gte: start } },
    }),
    prisma.pointsLedgerEntry.groupBy({
      by: ["offerId"],
      _count: { _all: true },
      where,
    }),
    prisma.offer.findMany({
      where: { partnerId, deletedAt: null },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Split by promotion. Every current offer is listed even at zero, so a venue
  // can see which of its promotions isn't landing; scans recorded before an
  // offer was chosen (or with none) collect under "unattributed".
  const countByOffer = new Map(perOfferRaw.map((r) => [r.offerId, r._count._all]));
  const perOffer = offers.map((o) => ({
    offerId: o.id,
    title: o.title,
    scans: countByOffer.get(o.id) ?? 0,
  }));
  const unattributed = countByOffer.get(null) ?? 0;

  return {
    scansTotal,
    scansToday,
    pointsToday: todaySum._sum.delta ?? 0,
    scansByDay,
    perOffer,
    unattributed,
  };
}
