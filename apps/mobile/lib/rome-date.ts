// Dates as the Bocconi timetable sees them: Europe/Rome, whatever the phone's
// timezone. Students plan around campus days, not their phone's.

const TZ = "Europe/Rome";

/** Today's date in Rome, YYYY-MM-DD. */
export function romeToday(now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return now.toLocaleDateString("en-CA", { timeZone: TZ });
  } catch {
    // An engine without time-zone data: the phone's own date is the best guess.
    const p = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  }
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Mon 12" for a YYYY-MM-DD date, in the app's language. */
export function shortDayLabel(date: string, locale: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", timeZone: "UTC" });
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}
