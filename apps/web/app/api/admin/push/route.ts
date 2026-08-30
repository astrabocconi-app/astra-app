import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { z } from "zod";
import { IN_APP_ROUTES } from "@astra/shared";
import { newRequestId, errorResponse, log } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { pushAudience, previewAudience, audienceTokens, audienceOptions } from "@/lib/push-audience";
import { sendPushToTokens } from "@/lib/push";

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
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
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
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/push — preview an audience, or send to it.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid input.",
      requestId,
    );
  }
  const { title, body, route, audience, confirm } = parsed.data;

  // Preview: never sends. The UI asks for this on every filter change.
  if (!confirm) {
    return NextResponse.json(
      { preview: await previewAudience(audience) },
      { headers: { "x-request-id": requestId } },
    );
  }

  const { tokens, userCount } = await audienceTokens(audience);
  if (tokens.length === 0) {
    return errorResponse(
      400,
      "NO_RECIPIENTS",
      "Nobody in that audience has notifications enabled, so nothing was sent.",
      requestId,
    );
  }

  const result = await sendPushToTokens(tokens, {
    title,
    body,
    // The app reads `route` to deep-link when the notification is tapped.
    data: route ? { route } : {},
  });

  const campaign = await prisma.pushCampaign.create({
    data: {
      title,
      body,
      route: route ?? null,
      filters: audience,
      sentCount: result.accepted,
      userCount,
      sentById: guard.session.user.id,
    },
  });

  await writeAudit({
    actorId: guard.session.user.id,
    action: "create",
    targetType: "PushCampaign",
    targetId: campaign.id,
    metadata: { title, accepted: result.accepted, failed: result.failed },
  });

  log("info", requestId, "POST /api/admin/push", {
    accepted: result.accepted,
    failed: result.failed,
  });

  return NextResponse.json(
    {
      id: campaign.id,
      accepted: result.accepted,
      failed: result.failed,
      userCount,
      // Surfaced rather than hidden: "sent to 300, 42 failed" is actionable,
      // "sent" is not.
      errors: result.errors,
    },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}
