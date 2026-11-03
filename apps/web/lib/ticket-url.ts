// Building the ticket link. Pure, so the test can import it.

/** Eventbrite event pages live on eventbrite.<tld> (.com, .it, .co.uk, ...). */
export function isEventbriteUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && /(^|\.)eventbrite\.[a-z]{2,3}(\.[a-z]{2})?$/i.test(hostname);
  } catch {
    return false;
  }
}

/**
 * Eventbrite applies a promo code passed as ?discount=CODE on the event page.
 * Any other site would just receive a stray query parameter (and the code), so
 * the link is returned untouched unless it really is an Eventbrite page.
 */
export function withDiscount(url: string, code: string): string {
  if (!isEventbriteUrl(url)) return url;
  const u = new URL(url);
  u.searchParams.set("discount", code);
  return u.toString();
}

/** Where tickets are sold: the admin's link, else the Eventbrite event page. */
export function ticketUrl(externalTicketUrl: string | null, eventbriteEventId: string | null): string | null {
  if (externalTicketUrl) return externalTicketUrl;
  return eventbriteEventId ? `https://www.eventbrite.com/e/${eventbriteEventId}` : null;
}

/**
 * Can an in-app discount be offered on this event? It needs the Eventbrite event
 * linked, and a ticket link (if any) that is itself an Eventbrite page: the code
 * is appended to that link, and on another site it would be useless and leaked.
 */
export function discountProblem(
  percent: number | boolean | null | undefined,
  eventbriteEventId: string | null | undefined,
  externalTicketUrl: string | null | undefined,
): string | null {
  if (!percent) return null;
  if (!eventbriteEventId) return "Link the Eventbrite event to give an in-app discount.";
  if (externalTicketUrl && !isEventbriteUrl(externalTicketUrl)) {
    return "An in-app discount needs the ticket link to be an Eventbrite page. Clear the ticket link or use the Eventbrite one.";
  }
  return null;
}

/**
 * The "-X%" shown for a fixed app price, for apps that only know percentages.
 * Rounded, and kept within 1-100 (the column's range): a price a few cents under
 * the full one still reads as a discount, and 0 reads as free.
 */
export function appPercent(priceCents: number, fullPriceCents: number): number {
  return Math.min(100, Math.max(1, Math.round((1 - priceCents / fullPriceCents) * 100)));
}
