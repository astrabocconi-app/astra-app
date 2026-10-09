// Free classrooms, worked out from Bocconi's own room-assignment page
// (https://didattica.unibocconi.it/aule/lista_orario.php). PURE parsing and
// availability logic: no I/O, so it can be tested against saved HTML.
//
// The page lists every lesson, exam and activity with its room and time slot.
// It never lists FREE rooms, so a room is free when no slot covers the time.
//
// Two traps this module exists to avoid:
//  1. The page's "dalle ore" filter keeps only slots that START at or after
//     that hour. A room booked 13:00-15:00 vanishes from a 14:00 query and
//     would look free. Callers must always load the whole day and let
//     `computeRooms` do the overlap maths.
//  2. Bocconi books its open study rooms as an "Attivita'" called "Aule
//     studio", which occupies the room in the timetable but is exactly when
//     students may use it. Those slots mean "study room", not "busy".

export interface RoomRef {
  /** Identity: building + room name, lower-cased. */
  key: string;
  name: string;
  /** "terra", "1", "-2"…; null when the page doesn't say. */
  floor: string | null;
  building: string;
}

export interface Assignment {
  /** YYYY-MM-DD */
  date: string;
  /** Minutes since midnight, Rome time. */
  start: number;
  end: number;
  /** "Lezione", "Esame (S)", "Attivita'"… */
  type: string;
  rooms: RoomRef[];
  /** An open "Aule studio" slot: the room is available for studying. */
  studyRoom: boolean;
}

export interface RoomStatus {
  name: string;
  building: string;
  floor: string | null;
  status: "free" | "occupied";
  /** Free rooms: when the next slot starts. Absent = free for the rest of the day. */
  freeUntil?: string;
  /** Free rooms inside an open "Aule studio" slot. */
  isStudyRoom?: boolean;
  /** …and when that study slot ends. */
  studyUntil?: string;
  /** Occupied rooms: when the current run of back-to-back slots ends. */
  occupiedUntil?: string;
}

// ── HTML ────────────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù",
  Agrave: "À", Egrave: "È", Eacute: "É", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** Cell text with <br> kept as line breaks. */
function cellLines(cell: string): string[] {
  const text = decodeEntities(cell.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** The page with a results table (header "Aule assegnate"). */
export function looksLikeTimetable(html: string): boolean {
  return /<th[^>]*>\s*Aule assegnate\s*<\/th>/i.test(html);
}

/**
 * A query with no assignments (a holiday, a day not published yet) does not
 * render the table: the page says "Nessun risultato" instead. That is an answer,
 * not a failure.
 */
export function isEmptyResult(html: string): boolean {
  return /Nessun risultato/i.test(html) && !looksLikeTimetable(html);
}

export function parseTime(hhmm: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const ROOM = /^(.+?),\s*Piano\s+(.+?),\s*(.+)$/i;

/** Rooms named in the "Aule assegnate" cell: one or more, separated by ";". */
export function parseRoomCell(lines: string[]): RoomRef[] {
  const out: RoomRef[] = [];
  for (const part of lines.flatMap((l) => l.split(";")).map((p) => p.trim())) {
    const m = ROOM.exec(part);
    // "C.M0.03", "Classroom 7", "Fuori sede", "Virtual Class"… are not campus
    // rooms with a floor and building; they never enter the free-room list.
    if (!m) continue;
    const name = m[1]!.replace(/\s+/g, " ").replace(/^aula\s+/i, "Aula ").trim();
    const floor = m[2]!.replace(/\s+/g, "").toLowerCase();
    const building = m[3]!.replace(/\s*\|\s*$/, "").replace(/\s+/g, " ").trim();
    if (!name || !building) continue;
    out.push({ key: `${building.toLowerCase()}|${name.toLowerCase()}`, name, floor: floor || null, building });
  }
  return out;
}

const STUDY_SLOT = /^aule? studio$/i;

export function parseTimetableHtml(html: string): Assignment[] {
  const out: Assignment[] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (let row = rowRe.exec(html); row; row = rowRe.exec(html)) {
    const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]!);
    if (cells.length < 8) continue; // header row and anything that isn't an assignment
    const dateText = cellLines(cells[0]!)[0] ?? "";
    const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
    const start = parseTime(cellLines(cells[1]!)[0] ?? "");
    const end = parseTime(cellLines(cells[2]!)[0] ?? "");
    if (!d || start === null || end === null || end <= start) continue;
    const type = (cellLines(cells[3]!)[0] ?? "").trim();
    const description = cellLines(cells[5]!)[0] ?? "";
    out.push({
      date: `${d[3]}-${d[2]}-${d[1]}`,
      start,
      end,
      type,
      rooms: parseRoomCell(cellLines(cells[7]!)),
      // Only the generic slot is open to everyone; "MAFINRISK - Aula studio"
      // is reserved for one programme and counts as busy.
      studyRoom: /^attiv/i.test(type) && STUDY_SLOT.test(description),
    });
  }
  return out;
}

// ── Rome time ───────────────────────────────────────────────────────────────

export const ROME_TZ = "Europe/Rome";

const romeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ROME_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Today's date and the minute of day in Rome, whatever the server's timezone. */
export function romeNow(at: Date = new Date()): { date: string; minutes: number } {
  const p = Object.fromEntries(romeFormat.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const DAY_ALIASES: Record<string, number> = { today: 0, tomorrow: 1, "day-after": 2 };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `date` (YYYY-MM-DD) wins over `day`, which is today | tomorrow | day-after —
 * or, for convenience, a YYYY-MM-DD date too. null = invalid.
 */
export function resolveDate(params: { day?: string; date?: string }, today: string): string | null {
  const explicit = params.date ? params.date : params.day && ISO_DATE.test(params.day) ? params.day : undefined;
  if (explicit !== undefined) {
    if (!ISO_DATE.test(explicit)) return null;
    const check = new Date(`${explicit}T00:00:00Z`);
    if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== explicit) return null;
    return explicit;
  }
  const offset = DAY_ALIASES[params.day ?? "today"];
  return offset === undefined ? null : addDays(today, offset);
}

// ── Rooms and availability ──────────────────────────────────────────────────

/** A building needs this many distinct rooms to count; filters one-off spaces. */
export const MIN_ROOMS_PER_BUILDING = 3;

export function collectRooms(assignments: Iterable<Assignment>, into: Map<string, RoomRef> = new Map()): Map<string, RoomRef> {
  for (const a of assignments) for (const r of a.rooms) if (!into.has(r.key)) into.set(r.key, r);
  return into;
}

/** Rooms of the buildings that have at least MIN_ROOMS_PER_BUILDING rooms. */
export function campusRooms(all: Map<string, RoomRef>): RoomRef[] {
  const perBuilding = new Map<string, number>();
  for (const r of all.values()) perBuilding.set(r.building, (perBuilding.get(r.building) ?? 0) + 1);
  return [...all.values()].filter((r) => (perBuilding.get(r.building) ?? 0) >= MIN_ROOMS_PER_BUILDING);
}

/** End of the run of slots that touch or overlap, starting from `from`. */
function runEnd(slots: Assignment[], from: number): number {
  let cur = from;
  for (let moved = true; moved; ) {
    moved = false;
    for (const s of slots) {
      if (s.start <= cur && s.end > cur) {
        cur = s.end;
        moved = true;
      }
    }
  }
  return cur;
}

export function computeRooms(universe: RoomRef[], dayAssignments: Assignment[], minute: number): RoomStatus[] {
  const byRoom = new Map<string, Assignment[]>();
  for (const a of dayAssignments) {
    for (const r of a.rooms) {
      const list = byRoom.get(r.key);
      if (list) list.push(a);
      else byRoom.set(r.key, [a]);
    }
  }

  return universe.map((room): RoomStatus => {
    const slots = byRoom.get(room.key) ?? [];
    const busy = slots.filter((a) => !a.studyRoom);
    const base = { name: room.name, building: room.building, floor: room.floor };

    const now = busy.filter((a) => a.start <= minute && minute < a.end);
    if (now.length) {
      const until = runEnd(busy, Math.max(...now.map((a) => a.end)));
      return { ...base, status: "occupied", occupiedUntil: formatTime(until) };
    }

    const next = busy.filter((a) => a.start > minute).map((a) => a.start);
    const freeUntil = next.length ? Math.min(...next) : null;
    const free: RoomStatus = { ...base, status: "free", ...(freeUntil !== null ? { freeUntil: formatTime(freeUntil) } : {}) };

    const study = slots.filter((a) => a.studyRoom);
    const studyNow = study.filter((a) => a.start <= minute && minute < a.end);
    if (studyNow.length) {
      const end = runEnd(study, Math.max(...studyNow.map((a) => a.end)));
      free.isStudyRoom = true;
      free.studyUntil = formatTime(freeUntil === null ? end : Math.min(end, freeUntil));
    }
    return free;
  });
}

const collator = new Intl.Collator("it", { numeric: true, sensitivity: "base" });
const BUILDING_ORDER = ["sarfatti 25", "sraffa 13", "roentgen"];

export function sortRooms<T extends { name: string; building: string }>(rooms: T[]): T[] {
  const rank = (b: string) => {
    const i = BUILDING_ORDER.indexOf(b.toLowerCase());
    return i === -1 ? BUILDING_ORDER.length : i;
  };
  return [...rooms].sort((a, b) => rank(a.building) - rank(b.building) || collator.compare(a.building, b.building) || collator.compare(a.name, b.name));
}
