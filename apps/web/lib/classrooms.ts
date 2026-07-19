// Free@B (freeatb.it) classroom availability — proxied server-side so the mobile
// app only ever talks to the ASTRA API. Free@B is a public Supabase edge function
// that live-scrapes Bocconi's timetable. The anon key is public (it ships in
// Free@B's own web client), so embedding it here is safe; both are overridable
// via env if the upstream ever moves.

const FREEATB_URL =
  process.env.FREEATB_FUNCTION_URL ??
  "https://fcvnrbxwipceoiqflvqs.supabase.co/functions/v1/scrape-rooms";
const FREEATB_ANON_KEY =
  process.env.FREEATB_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdm5yYnh3aXBjZW9pcWZsdnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNDk3NDAsImV4cCI6MjA3NzcyNTc0MH0.GsQZVyLHXeJuDEIGgwpC8DD7gjVPtMiQ6j-DwASNg_Q";

export interface Classroom {
  name: string;
  building: string;
  status: "free" | "occupied";
  freeUntil?: string;
  isStudyRoom?: boolean;
}

export interface ClassroomsResult {
  rooms: Classroom[];
  freeRooms: number;
  totalRooms: number;
  timestamp: string | null;
}

// time = "HH:MM" (defaults to now), day = "today" | "tomorrow" | "day-after".
export async function fetchClassrooms(params: {
  time?: string;
  day?: string;
}): Promise<ClassroomsResult> {
  const qs = new URLSearchParams();
  if (params.time) qs.set("time", params.time);
  if (params.day) qs.set("day", params.day);
  const url = FREEATB_URL + (qs.toString() ? `?${qs}` : "");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: FREEATB_ANON_KEY,
      Authorization: `Bearer ${FREEATB_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Free@B upstream ${res.status}`);

  const data = (await res.json()) as {
    rooms?: Classroom[];
    freeRooms?: number;
    totalRooms?: number;
    timestamp?: string;
  };
  const rooms = Array.isArray(data.rooms) ? data.rooms : [];
  return {
    rooms,
    freeRooms: data.freeRooms ?? rooms.filter((r) => r.status === "free").length,
    totalRooms: data.totalRooms ?? rooms.length,
    timestamp: data.timestamp ?? null,
  };
}
