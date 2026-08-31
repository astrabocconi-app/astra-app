import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { listEvents, isEventbriteConfigured, EventbriteError } from "@/lib/eventbrite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/eventbrite/events — events to attach generated discounts to.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "events");
  if ("error" in guard) return guard.error;

  if (!isEventbriteConfigured()) {
    return NextResponse.json(
      { configured: false, events: [] },
      { headers: { "x-request-id": requestId } },
    );
  }

  try {
    const events = await listEvents();
    return NextResponse.json(
      { configured: true, events },
      { headers: { "x-request-id": requestId } },
    );
  } catch (e) {
    if (e instanceof EventbriteError) {
      return errorResponse(502, "EVENTBRITE_ERROR", e.message, requestId);
    }
    throw e;
  }
}
