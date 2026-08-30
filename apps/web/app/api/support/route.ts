import { NextResponse } from "next/server";
import { prisma, SupportKind } from "@astra/db";
import { supportMessageInput } from "@astra/shared";
import { newRequestId, errorResponse, log } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How many messages one account may send per hour.
 *
 * Generous enough that nobody writing in good faith notices, low enough that a
 * stuck retry loop or a bored student can't flood the backoffice inbox.
 */
const MAX_PER_HOUR = 5;

// POST /api/support — send a question, issue or idea from the app.
//
// Authenticated on purpose: the point of this feature is being able to write
// back, so the reporter's identity comes from the session rather than a
// self-reported email field that can be mistyped or faked.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = supportMessageInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid input.",
      requestId,
    );
  }
  const d = parsed.data;

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.supportMessage.count({
    where: { userId: session.user.id, createdAt: { gte: since } },
  });
  if (recent >= MAX_PER_HOUR) {
    return errorResponse(
      429,
      "TOO_MANY",
      "You've sent a few messages already — we'll get back to you shortly.",
      requestId,
    );
  }

  const created = await prisma.supportMessage.create({
    data: {
      userId: session.user.id,
      kind: d.kind as SupportKind,
      message: d.message,
      appVersion: d.appVersion ?? null,
      platform: d.platform ?? null,
    },
  });

  log("info", requestId, "POST /api/support", {
    userId: session.user.id,
    kind: created.kind,
    id: created.id,
  });
  return NextResponse.json(
    { id: created.id, createdAt: created.createdAt.toISOString() },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}
