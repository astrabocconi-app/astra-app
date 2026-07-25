import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { fetchClassrooms } from "@/lib/classrooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/classrooms?time=HH:MM&day=today|tomorrow|day-after
// Proxies Free@B (freeatb.it) live Bocconi classroom availability.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }
  const { searchParams } = new URL(req.url);
  const time = searchParams.get("time") ?? undefined;
  const day = searchParams.get("day") ?? undefined;
  try {
    const data = await fetchClassrooms({ time, day });
    return NextResponse.json(data, { headers: { "x-request-id": requestId } });
  } catch {
    return errorResponse(
      502,
      "UPSTREAM_ERROR",
      "Couldn't reach the classroom service. Try again shortly.",
      requestId,
    );
  }
}
