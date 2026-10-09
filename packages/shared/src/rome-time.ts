// Europe/Rome wall-clock helpers, built on Intl only (no date library).
//
// Staff type event times as Milan wall time, but a browser's datetime-local
// value has no zone and the server runs in UTC. These two functions pin the
// zone explicitly, so a laptop in any timezone saves and shows the same time.

export const ROME_TZ = "Europe/Rome";

// Built on first use so merely importing @astra/shared never touches Intl.
let fmt: Intl.DateTimeFormat | undefined;
const makeFmt = () =>
  new Intl.DateTimeFormat("en-GB", {
  timeZone: ROME_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  });

/** Rome's offset from UTC, in minutes, at the given instant (+60 winter, +120 summer). */
function offsetMinutes(ms: number): number {
  const p: Record<string, number> = {};
  for (const part of (fmt ??= makeFmt()).formatToParts(new Date(ms))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const n = (k: string) => p[k] ?? 0;
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** "2026-10-10T21:30:00+02:00" for the instant `ms`, written in Rome wall time. */
function withOffset(ms: number, offset: number): string {
  const wall = new Date(ms + offset * 60000).toISOString().slice(0, 19);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${wall}${sign}${hh}:${mm}`;
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * A datetime-local value ("2026-10-10T21:30") read as Europe/Rome wall time,
 * returned as an ISO string WITH offset ("2026-10-10T21:30:00+02:00").
 *
 * Across the DST switches: a wall time that happens twice (autumn, 02:00-02:59)
 * resolves to its first occurrence; one that never happens (spring, 02:00-02:59)
 * moves forward by the skipped hour.
 */
export function romeInputToIso(local: string): string {
  const m = LOCAL.exec(local.trim());
  if (!m) throw new RangeError(`Not a datetime-local value: ${local}`);
  const [y = 0, mo = 1, d = 1, h = 0, mi = 0, s = 0] = m.slice(1).map((v) => Number(v ?? 0));
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const day = 86400000;
  const before = offsetMinutes(wall - day);
  const after = offsetMinutes(wall + day);
  const valid = [...new Set([before, after])]
    .map((o) => ({ o, utc: wall - o * 60000 }))
    .filter(({ o, utc }) => offsetMinutes(utc) === o)
    .sort((a, b) => a.utc - b.utc);
  // No valid candidate = the skipped hour: apply the pre-switch offset.
  const pick = valid[0] ?? { o: before, utc: wall - before * 60000 };
  return withOffset(pick.utc, offsetMinutes(pick.utc));
}

/** An ISO instant → the datetime-local value ("2026-10-10T21:30") in Rome time; "" if unparseable. */
export function isoToRomeInput(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + offsetMinutes(ms) * 60000).toISOString().slice(0, 16);
}
