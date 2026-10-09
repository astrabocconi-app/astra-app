import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { z } from "zod";
import { IN_APP_ROUTES } from "@astra/shared";
import { newRequestId, errorResponse, log, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { pushAudience, previewAudience, audienceOptions } from "@/lib/push-audience";
import { sendCampaign, NoRecipientsError } from "@/lib/push-campaign";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const input = z.object({
  title: z.string().trim().min(1, "Give the notification a title").max(80),
  body: z.string().trim().min(1, "Write a message").max(300),
  /** Where tapping it should land. Same allowlist as content links. */
  route: z.enum(IN_APP_ROUTES).nullish(),
  audience: pushAudience,
  /**
   * Must be true to actually send. A preview is the default so that a
   * mistyped filter costs a page refresh rather than an unrecallable
   * notification to every student.
   */
  confirm: z.boolean().default(false),
});

// GET /api/admin/push — filter options + recent sends.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "push");
  if ("error" in guard) return guard.error;

  const [options, recent, totalDevices] = await Promise.all([
    audienceOptions(),
    prisma.pushCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { sentBy: { select: { name: true, email: true } } },
    }),
    prisma.pushToken.count(),
  ]);

  return NextResponse.json(
    {
      options,
      totalDevices,
      recent: recent.map((c) => ({
        id: c.id,
        title: c.title,
        body: c.body,
        route: c.route,
        sentCount: c.sentCount,
        userCount: c.userCount,
        sentBy: c.sentBy?.name ?? c.sentBy?.email ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    },
  );
}

// POST /api/admin/push — preview an audience, or send to it.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "push");
  if ("error" in guard) return guard.error;

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      zodMessage(parsed.error),
      requestId,
    );
  }
  const { title, body, route, audience, confirm } = parsed.data;

  // Preview: never sends. The UI asks for this on every filter change.
  if (!confirm) {
    return NextResponse.json(
      { preview: await previewAudience(audience) },
      );
  }

  try {
    const sent = await sendCampaign({
      actorId: guard.session.user.id,
      title,
      body,
      route: route ?? null,
      audience,
    });
    log("info", requestId, "push campaign sent", { accepted: sent.accepted, failed: sent.failed });
    return NextResponse.json(
      {
        id: sent.campaign.id,
        accepted: sent.accepted,
        failed: sent.failed,
        userCount: sent.userCount,
        // Surfaced rather than hidden: "sent to 300, 42 failed" is actionable,
        // "sent" is not.
        errors: sent.errors,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof NoRecipientsError) {
      return errorResponse(400, "NO_RECIPIENTS", e.message, requestId);
    }
    throw e;
  }
}

export const GET = withApi(handleGet);
export const POST = withApi(handlePost);
