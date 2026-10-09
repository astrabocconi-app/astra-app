// Date formatting for the backoffice, always in Milan time.
//
// The server runs in UTC and staff may sit in any timezone, so every formatter
// pins Europe/Rome. Without that, a 21:30 event shows as 19:30 on the server.

import { ROME_TZ, romeInputToIso } from "@astra/shared";

const make = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: ROME_TZ, ...opts });

const dateTime = make({ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = make({ day: "numeric", month: "short", year: "numeric" });
const dayKey = make({ year: "numeric", month: "2-digit", day: "2-digit" });

type D = Date | string | number;
const d = (v: D) => (v instanceof Date ? v : new Date(v));

/** "9 Oct 2026, 21:30" in Milan time. */
export const romeDateTime = (v: D) => dateTime.format(d(v));

/** "9 Oct 2026" in Milan time. */
export const romeDate = (v: D) => dateOnly.format(d(v));

/** "2026-10-09" — the Milan calendar day an instant falls on. */
export function romeDayKey(v: D): string {
  const p = Object.fromEntries(dayKey.formatToParts(d(v)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** The instant today (Milan) began, i.e. 00:00 Europe/Rome. */
export function romeDayStart(now: D = new Date()): Date {
  return new Date(romeInputToIso(`${romeDayKey(now)}T00:00`));
}
