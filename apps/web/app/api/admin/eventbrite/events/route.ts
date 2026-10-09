import { NextResponse } from "next/server";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { canAccessPage } from "@/lib/dashboard-access";
import { listEvents, getEvent, isEventbriteConfigured, EventbriteError } from "@/lib/eventbrite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/eventbrite/events — events to attach generated discounts to.
// Open to the Events page (linking an event) AND the Rewards page (the voucher
// generator picks an event too): gating it on Events alone broke the generator
// for staff who have Rewards only.
//
// `?id=<eventbrite id>` returns just that event, so the editor can show the
// status of a linked event even when it has fallen outside the list.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  if (!canAccessPage(session, "events") && !canAccessPage(session, "rewards")) {
    return errorResponse(403, "FORBIDDEN", "You do not have access to this section.", requestId);
  }

  if (!isEventbriteConfigured()) {
    return NextResponse.json({ configured: false, events: [] });
  }

  try {
    const id = new URL(req.url).searchParams.get("id");
    const events = id ? [await getEvent(id)].filter((e) => e !== null) : await listEvents();
    return NextResponse.json({ configured: true, events });
  } catch (e) {
    if (e instanceof EventbriteError) {
      return errorResponse(502, "EVENTBRITE_ERROR", e.message, requestId);
    }
    throw e;
  }
}

export const GET = withApi(handleGet);
