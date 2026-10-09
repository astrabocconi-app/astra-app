// In-app ticket discounts. SERVER-ONLY.
//
// An event linked to its Eventbrite event can give students who buy through the
// app a percentage off. Each student gets a personal single-use Eventbrite code
// the first time they tap "Get tickets" — a shared code would end up in group
// chats — and the same code on every later tap.
//
// The per-event cap is hard: a slot is RESERVED (a placeholder row, written
// under a per-event advisory lock) before Eventbrite is called, so a rush of
// first taps near the limit cannot all pass a stale count and overshoot it. The
// placeholder is the row with an empty eventbriteDiscountId; it is filled in
// when Eventbrite answers and deleted if it does not.

import { prisma, Prisma } from "@astra/db";
import type { TicketLinkResponse } from "@astra/shared";
import { createDiscount, generateCode, isEventbriteConfigured, DuplicateCodeError } from "./eventbrite";
import { revokeDiscounts } from "./eventbrite-revoke";
import { ticketUrl, withDiscount, isEventbriteUrl } from "./ticket-url";
import { log, newRequestId } from "./api";

export class TicketLinkError extends Error {}

/** A reservation older than this was abandoned (the lambda died mid-call). */
const STALE_RESERVATION_MS = 90_000;

type Discount = NonNullable<Awaited<ReturnType<typeof prisma.eventAppDiscount.findUnique>>>;

const issued = (d: Discount) => d.eventbriteDiscountId !== "";

export async function ticketLinkFor(eventId: string, userId: string): Promise<TicketLinkResponse> {
  const event = await prisma.event.findFirst({ where: { id: eventId, published: true, deletedAt: null } });
  if (!event) throw new TicketLinkError("Event not found.");
  const url = ticketUrl(event.externalTicketUrl, event.eventbriteEventId);
  if (!url) throw new TicketLinkError("This event has no tickets.");
  // `discountStatus` is additive: older apps ignore it, newer ones use it to tell
  // "this event has no discount" from "the discount is temporarily unavailable".
  const plain = (discountStatus: NonNullable<TicketLinkResponse["discountStatus"]>): TicketLinkResponse => ({
    url,
    code: null,
    percentOff: null,
    discountStatus,
  });
  const withCode = (d: { code: string; percentOff: number }): TicketLinkResponse => ({
    url: withDiscount(url, d.code),
    code: d.code,
    percentOff: d.percentOff,
    discountStatus: "applied",
  });

  const existing = await prisma.eventAppDiscount.findUnique({ where: { eventId_userId: { eventId, userId } } });
  if (existing && issued(existing)) return withCode(existing);

  const percent = event.appDiscountPercent;
  if (!percent || !event.eventbriteEventId || !isEventbriteConfigured()) return plain("none");
  // A code appended to someone else's website would be worthless (and leak the code).
  if (!isEventbriteUrl(url)) return plain("none");

  if (existing) {
    // Our own reservation. A fresh one means a double tap is still in flight; a
    // stale one means the earlier attempt died, so free the slot and retry.
    if (Date.now() - existing.createdAt.getTime() < STALE_RESERVATION_MS) return plain("unavailable");
    await prisma.eventAppDiscount.deleteMany({ where: { id: existing.id, eventbriteDiscountId: "" } });
  }

  const reservation = await reserveSlot(eventId, userId, percent, event.appDiscountLimit);
  if (reservation === "full") return plain("cap_reached");
  if (reservation === "taken") {
    const winner = await prisma.eventAppDiscount.findUnique({ where: { eventId_userId: { eventId, userId } } });
    return winner && issued(winner) ? withCode(winner) : plain("unavailable");
  }

  // Never let Eventbrite trouble stop a student from buying: fall back to the
  // plain link and let them pay full price rather than nothing.
  let created;
  try {
    created = await createWithFreshCode(event.eventbriteEventId, percent);
  } catch (e) {
    log("warn", newRequestId(), "ticket discount not created", { eventId, status: (e as { status?: number }).status });
    await prisma.eventAppDiscount.deleteMany({ where: { id: reservation.id, eventbriteDiscountId: "" } });
    return plain("unavailable");
  }

  try {
    await prisma.eventAppDiscount.update({
      where: { id: reservation.id },
      data: { code: created.code, eventbriteDiscountId: created.id },
    });
  } catch (e) {
    // The code exists on Eventbrite but we could not record it: revoke it (and
    // queue it for the cron if Eventbrite is slow) rather than leak a live code.
    await revokeDiscounts([created.id]);
    await prisma.eventAppDiscount.deleteMany({ where: { id: reservation.id, eventbriteDiscountId: "" } });
    throw e;
  }
  return withCode({ code: created.code, percentOff: percent });
}

/**
 * Take a slot for this student, or say why not. The advisory lock makes
 * "count the slots, then insert" one step per event; it is held for a couple of
 * statements only, never across the Eventbrite call.
 */
async function reserveSlot(
  eventId: string,
  userId: string,
  percentOff: number,
  limit: number | null,
): Promise<{ id: string } | "full" | "taken"> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
      if (limit != null) {
        const taken = await tx.eventAppDiscount.count({ where: { eventId } });
        if (taken >= limit) return "full" as const;
      }
      const row = await tx.eventAppDiscount.create({
        data: { eventId, userId, code: "", eventbriteDiscountId: "", percentOff },
        select: { id: true },
      });
      return row;
    });
  } catch (e) {
    // Two taps at once from the same student: the other one holds the slot.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "taken";
    throw e;
  }
}

async function createWithFreshCode(eventbriteEventId: string, percentOff: number) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await createDiscount({ eventId: eventbriteEventId, code: generateCode("APP"), percentOff });
    } catch (e) {
      if (!(e instanceof DuplicateCodeError) || attempt >= 2) throw e;
    }
  }
}

/** How many students have a code for each event (for the backoffice). Reservations in flight are not counted. */
export async function issuedCounts(eventIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.eventAppDiscount.groupBy({
    by: ["eventId"],
    _count: true,
    where: { eventId: { in: eventIds }, eventbriteDiscountId: { not: "" } },
  });
  return new Map(rows.map((r) => [r.eventId, r._count]));
}
