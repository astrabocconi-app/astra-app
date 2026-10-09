// Europe/Rome day boundaries for the server. SERVER-ONLY (but pure).
//
// Vercel runs in UTC, so `setHours(0,0,0,0)` cuts the "day" at 01:00/02:00
// Milan time: events that started the previous evening vanished an hour early
// and a venue's "scans today" reset in the middle of the night. Everything the
// students and staff see as "today" is Milan's today. Pure Intl, no
// date library.

export const ROME_TZ = "Europe/Rome";

// Built on first use: Intl.DateTimeFormat construction is not free.
let dayFmt: Intl.DateTimeFormat | undefined;

/** "2026-10-10": the calendar day in Rome that this instant falls on. */
export function romeDateKey(at: Date = new Date()): string {
  dayFmt ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dayFmt.formatToParts(at)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * The instant of 00:00 Rome time on the given calendar day. Rome is UTC+1 or
 * UTC+2 and clocks change at 02:00-03:00, so midnight is always 22:00Z or 23:00Z
 * of the day before: test both and keep the one that really starts the day.
 */
export function startOfRomeDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const midnightUtc = Date.UTC(y!, m! - 1, d!);
  for (const hours of [2, 1]) {
    const candidate = new Date(midnightUtc - hours * 3600_000);
    if (romeDateKey(candidate) === key && romeDateKey(new Date(candidate.getTime() - 1)) !== key) {
      return candidate;
    }
  }
  return new Date(midnightUtc - 3600_000); // unreachable for Europe/Rome
}

/** Midnight (Rome) at the start of the day containing `at`. */
export function startOfRomeDay(at: Date = new Date()): Date {
  return startOfRomeDayKey(romeDateKey(at));
}

/** A day key shifted by whole calendar days (pure date arithmetic, DST-proof). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** The Monday on or before a day key: Postgres' date_trunc('week') bucket. */
export function mondayOnOrBefore(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
  return addDaysToKey(key, -weekday);
}

/**
 * Every bucket key from `sinceKey` to `todayKey`, so quiet periods read as zero
 * instead of vanishing and compressing the chart's axis.
 */
export function bucketKeys(sinceKey: string, todayKey: string, unit: "day" | "week"): string[] {
  const out: string[] = [];
  let key = unit === "week" ? mondayOnOrBefore(sinceKey) : sinceKey;
  while (key <= todayKey) {
    out.push(key);
    key = addDaysToKey(key, unit === "week" ? 7 : 1);
  }
  return out;
}
