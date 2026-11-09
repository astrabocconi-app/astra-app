/** Minutes kept free before the next class: nobody wants a room they must leave right away. */
export const BUFFER_MINUTES = 15;

type Room = { status: "free" | "occupied"; freeUntil?: string; studyUntil?: string };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * A free room as shown to students: free until 15 minutes before its next
 * class (the disclaimer on the screen says so), and not free at all when that
 * moment has already come. `at` is the minute being looked at.
 */
export function withBuffer<R extends Room>(room: R, at: number | null): R {
  if (room.status !== "free" || !room.freeUntil) return room;
  const until = toMin(room.freeUntil) - BUFFER_MINUTES;
  if (at !== null && until <= at) return { ...room, status: "occupied" };
  const studyUntil = room.studyUntil ? fmt(Math.min(toMin(room.studyUntil), until)) : room.studyUntil;
  return { ...room, freeUntil: fmt(until), ...(room.studyUntil ? { studyUntil } : {}) };
}
