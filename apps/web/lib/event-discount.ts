// In-app ticket discounts. SERVER-ONLY.
//
// An event linked to its Eventbrite event can give students who buy through the
// app a percentage off. Each student gets a personal single-use Eventbrite code
// the first time they tap "Get tickets" — a shared code would end up in group
// chats — and the same code on every later tap.

import { prisma, Prisma } from "@astra/db";
import type { TicketLinkResponse } from "@astra/shared";
import { createDiscount, deleteDiscount, generateCode, isEventbriteConfigured, DuplicateCodeError } from "./eventbrite";
import { ticketUrl, withDiscount } from "./ticket-url";

export class TicketLinkError extends Error {}

export async function ticketLinkFor(eventId: string, userId: string): Promise<TicketLinkResponse> {
  const event = await prisma.event.findFirst({ where: { id: eventId, published: true, deletedAt: null } });
  if (!event) throw new TicketLinkError("Event not found.");
  const url = ticketUrl(event.externalTicketUrl, event.eventbriteEventId);
  if (!url) throw new TicketLinkError("This event has no tickets.");
  const plain = { url, code: null, percentOff: null };

  const existing = await prisma.eventAppDiscount.findUnique({ where: { eventId_userId: { eventId, userId } } });
  if (existing) return { url: withDiscount(url, existing.code), code: existing.code, percentOff: existing.percentOff };

  const percent = event.appDiscountPercent;
  if (!percent || !event.eventbriteEventId || !isEventbriteConfigured()) return plain;
  if (event.appDiscountLimit != null) {
    const issued = await prisma.eventAppDiscount.count({ where: { eventId } });
    if (issued >= event.appDiscountLimit) return plain;
  }

  // Never let Eventbrite trouble stop a student from buying: fall back to the
  // plain link and let them pay full price rather than nothing.
  let created;
  try {
    created = await createWithFreshCode(event.eventbriteEventId, percent);
  } catch {
    return plain;
  }

  try {
    await prisma.eventAppDiscount.create({
      data: { eventId, userId, code: created.code, eventbriteDiscountId: created.id, percentOff: percent },
    });
  } catch (e) {
    // Two taps at once: the other one won. Drop our code, use theirs.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      void deleteDiscount(created.id);
      const winner = await prisma.eventAppDiscount.findUniqueOrThrow({ where: { eventId_userId: { eventId, userId } } });
      return { url: withDiscount(url, winner.code), code: winner.code, percentOff: winner.percentOff };
    }
    void deleteDiscount(created.id);
    throw e;
  }
  return { url: withDiscount(url, created.code), code: created.code, percentOff: percent };
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

/** How many students have a code for each event (for the backoffice). */
export async function issuedCounts(eventIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.eventAppDiscount.groupBy({ by: ["eventId"], _count: true, where: { eventId: { in: eventIds } } });
  return new Map(rows.map((r) => [r.eventId, r._count]));
}
