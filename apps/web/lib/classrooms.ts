// Free classrooms. SERVER-ONLY.
//
// Read straight from Bocconi's room-assignment page (see classrooms-core.ts for
// the parsing and the rules). We used to proxy Free@B, a third-party scraper
// whose room list changed with every query and left out a whole building.

import {
  addDays,
  campusRooms,
  collectRooms,
  computeRooms,
  isEmptyResult,
  looksLikeTimetable,
  parseTime,
  parseTimetableHtml,
  resolveDate,
  romeNow,
  sortRooms,
  type Assignment,
  type RoomRef,
  type RoomStatus,
} from "./classrooms-core";

const SOURCE_URL = "https://didattica.unibocconi.it/aule/lista_orario.php";

export type Classroom = RoomStatus;

export interface ClassroomsResult {
  rooms: Classroom[];
  freeRooms: number;
  totalRooms: number;
  /** When the timetable was read (ISO, UTC). */
  timestamp: string;
  /** The day and time the answer is for, in Rome time. */
  date: string;
  time: string;
  source: "bocconi";
  /** False when the full room list couldn't be built and only rooms seen on this day are shown. */
  complete: boolean;
}

export class ClassroomsInputError extends Error {}
export class TimetableError extends Error {}

// Upstream is the university's own server: be gentle and identify ourselves.
const HEADERS = { "User-Agent": "ASTRA-app/1.0 (+https://app.astrabocconi.com)", Accept: "text/html" };

/** The whole range, from midnight — the page's hour filter only matches slots that START later. */
function timetableUrl(from: string, to: string, room = ""): string {
  const [fy, fm, fd] = from.split("-") as [string, string, string];
  const [ty, tm, td] = to.split("-") as [string, string, string];
  const q = new URLSearchParams({
    ric_tipo: "",
    ric_aula: room,
    ric_descriz: "",
    ric_da_gg: fd,
    ric_da_mm: fm,
    ric_da_aa: fy,
    ric_a_gg: td,
    ric_a_mm: tm,
    ric_a_aa: ty,
    ric_da_hh: "0",
    ric_da_ii: "00",
    cerca: "CERCA",
  });
  return `${SOURCE_URL}?${q}`;
}

async function loadTimetable(from: string, to: string, timeoutMs: number, room = ""): Promise<Assignment[]> {
  let res: Response;
  try {
    res = await fetch(timetableUrl(from, to, room), { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new TimetableError("Couldn't reach the Bocconi timetable.");
  }
  if (!res.ok) throw new TimetableError(`Bocconi timetable returned ${res.status}.`);
  const html = await res.text();
  // "Nessun risultato" is a real answer: nothing is assigned in that range.
  if (isEmptyResult(html)) return [];
  // Anything else that isn't the results table is a redesigned page, and must fail
  // loudly: reading it as "no lessons" would show every room as free.
  if (!looksLikeTimetable(html)) throw new TimetableError("The Bocconi timetable page has changed shape.");
  const rows = parseTimetableHtml(html);
  if (rows.length === 0) throw new TimetableError("The Bocconi timetable has rows this app can't read.");
  return rows;
}

/**
 * Can this server reach Bocconi's page, and does it still look like the
 * assignment list? Asks for a room that doesn't exist, so the answer is tiny.
 * Cached, because health checks run often and the page isn't ours to hammer.
 */
const PROBE_TTL_MS = 5 * 60_000;
const PROBE_FAIL_TTL_MS = 30_000;
let probe: { at: number; ttl: number; value: Promise<void> } | null = null;

export function probeTimetable(): Promise<void> {
  const now = Date.now();
  if (probe && now - probe.at < probe.ttl) return probe.value;
  const entry = { at: now, ttl: PROBE_TTL_MS, value: loadTimetable(romeNow().date, romeNow().date, 6_000, "astra-health-probe").then(() => undefined) };
  probe = entry;
  entry.value.catch(() => {
    entry.ttl = PROBE_FAIL_TTL_MS;
  });
  return entry.value;
}

// ── Caches (per warm serverless instance) ───────────────────────────────────

const DAY_TTL_MS = 90_000;
const days = new Map<string, { at: number; value: Promise<Assignment[]> }>();

function getDay(date: string): Promise<Assignment[]> {
  const now = Date.now();
  for (const [k, v] of days) if (now - v.at > DAY_TTL_MS) days.delete(k); // bounded: only live keys stay
  const hit = days.get(date);
  if (hit) return hit.value;
  const value = loadTimetable(date, date, 10_000);
  days.set(date, { at: now, value });
  value.catch(() => days.delete(date));
  return value;
}

// The room list: every room used in the 150 days around today. The page never
// lists empty rooms, so this is the only way to know a quiet room exists.
const UNIVERSE_TTL_MS = 6 * 60 * 60_000;
const UNIVERSE_RETRY_MS = 5 * 60_000;
const WINDOW_DAYS = 75;
const CHUNK_DAYS = 30;

interface Universe {
  rooms: RoomRef[];
  complete: boolean;
}
let universe: { at: number; ttl: number; value: Promise<Universe> } | null = null;

async function buildUniverse(today: string): Promise<Universe> {
  const chunks: [string, string][] = [];
  for (let from = addDays(today, -WINDOW_DAYS); from <= addDays(today, WINDOW_DAYS); from = addDays(from, CHUNK_DAYS)) {
    chunks.push([from, addDays(from, CHUNK_DAYS - 1)]);
  }
  const results = await Promise.allSettled(chunks.map(([from, to]) => loadTimetable(from, to, 15_000)));
  const rooms = new Map<string, RoomRef>();
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") collectRooms(r.value, rooms);
    else failed++;
  }
  if (failed === results.length) throw new TimetableError("Couldn't build the room list.");
  return { rooms: campusRooms(rooms), complete: failed === 0 };
}

function getUniverse(today: string): Promise<Universe> {
  const now = Date.now();
  if (universe && now - universe.at < universe.ttl) return universe.value;
  const value = buildUniverse(today);
  const entry = { at: now, ttl: UNIVERSE_TTL_MS, value };
  universe = entry;
  value.then(
    (u) => {
      // A partial list is retried soon rather than trusted for six hours.
      if (!u.complete && universe === entry) entry.ttl = UNIVERSE_RETRY_MS;
    },
    () => {
      if (universe === entry) universe = null;
    },
  );
  return value;
}

// ── Public ──────────────────────────────────────────────────────────────────

/** Furthest day ahead we answer for; the timetable is published a few weeks out. */
const MAX_DAYS_AHEAD = 30;

export async function fetchClassrooms(params: { day?: string; date?: string; time?: string }): Promise<ClassroomsResult> {
  const now = romeNow();
  const date = resolveDate(params, now.date);
  if (!date) throw new ClassroomsInputError("Invalid day.");
  if (date < now.date || date > addDays(now.date, MAX_DAYS_AHEAD)) throw new ClassroomsInputError("Day out of range.");

  let minute: number;
  if (params.time) {
    const parsed = parseTime(params.time);
    if (parsed === null) throw new ClassroomsInputError("Invalid time.");
    minute = parsed;
  } else {
    // "Now" only means something today; any other day starts with the morning.
    minute = date === now.date ? now.minutes : 8 * 60;
  }

  const [dayAssignments, uni] = await Promise.all([getDay(date), getUniverse(now.date).catch(() => null)]);

  // No assignments at all means no timetable for that day (a holiday, or not
  // published yet), not "every room is free".
  if (dayAssignments.length === 0) {
    return {
      rooms: [],
      freeRooms: 0,
      totalRooms: 0,
      timestamp: new Date().toISOString(),
      date,
      time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
      source: "bocconi",
      complete: uni?.complete ?? false,
    };
  }

  const known = new Map<string, RoomRef>((uni?.rooms ?? []).map((r) => [r.key, r]));
  // Rooms seen today but missing from the list (new rooms) join it, as long as
  // their building is a real one.
  const seenToday = collectRooms(dayAssignments);
  const campus = new Set(campusRooms(uni ? new Map([...known, ...seenToday]) : seenToday).map((r) => r.key));
  for (const [key, room] of seenToday) if (campus.has(key) && !known.has(key)) known.set(key, room);

  const rooms = sortRooms(computeRooms([...known.values()].filter((r) => campus.has(r.key)), dayAssignments, minute));
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return {
    rooms,
    freeRooms: rooms.filter((r) => r.status === "free").length,
    totalRooms: rooms.length,
    timestamp: new Date().toISOString(),
    date,
    time: `${hh}:${mm}`,
    source: "bocconi",
    complete: uni?.complete ?? false,
  };
}
