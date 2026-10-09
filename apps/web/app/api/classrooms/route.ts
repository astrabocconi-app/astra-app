import { NextResponse } from "next/server";
import { newRequestId, errorResponse, log, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { fetchClassrooms, ClassroomsInputError, TimetableError } from "@/lib/classrooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/classrooms?date=YYYY-MM-DD | day=today|tomorrow|day-after, &time=HH:MM
// Free classrooms computed from Bocconi's own room-assignment page. `day` stays
// for installed app versions; `date` wins when both are sent.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  const { searchParams } = new URL(req.url);
  try {
    const data = await fetchClassrooms({
      day: searchParams.get("day") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      time: searchParams.get("time") ?? undefined,
    });
    return NextResponse.json(data, { headers: { "x-request-id": requestId } });
  } catch (e) {
    if (e instanceof ClassroomsInputError) {
      return errorResponse(400, "BAD_REQUEST", e.message, requestId);
    }
    // The page changing shape is the one failure worth a loud log line.
    log("error", requestId, "GET /api/classrooms failed", {
      reason: e instanceof TimetableError ? e.message : "unexpected",
    });
    return errorResponse(502, "UPSTREAM_ERROR", "Couldn't read the Bocconi timetable. Try again shortly.", requestId);
  }
}

export const GET = withApi(handleGet);
