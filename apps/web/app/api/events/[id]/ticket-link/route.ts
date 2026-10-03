import { NextResponse } from "next/server";
import { newRequestId, errorResponse, log } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { ticketLinkFor, TicketLinkError } from "@/lib/event-discount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/events/:id/ticket-link — where "Get tickets" should send this
// student: with their personal in-app discount code when the event has one.
// POST because the first call creates the code on Eventbrite.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  const { id } = await ctx.params;

  try {
    const link = await ticketLinkFor(id, session.user.id);
    log("info", requestId, "POST /api/events/:id/ticket-link", { userId: session.user.id, eventId: id, discounted: Boolean(link.code) });
    return NextResponse.json(link, { headers: { "x-request-id": requestId } });
  } catch (e) {
    if (e instanceof TicketLinkError) return errorResponse(404, "NOT_FOUND", e.message, requestId);
    throw e;
  }
}
