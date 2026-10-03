// Building the ticket link. Pure, so the test can import it.

/** Eventbrite applies a promo code passed as ?discount=CODE on the event page. */
export function withDiscount(url: string, code: string): string {
  const u = new URL(url);
  u.searchParams.set("discount", code);
  return u.toString();
}

/** Where tickets are sold: the admin's link, else the Eventbrite event page. */
export function ticketUrl(externalTicketUrl: string | null, eventbriteEventId: string | null): string | null {
  if (externalTicketUrl) return externalTicketUrl;
  return eventbriteEventId ? `https://www.eventbrite.com/e/${eventbriteEventId}` : null;
}
