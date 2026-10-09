// Sending a push campaign: the one path every mass notification goes through.
// SERVER-ONLY.
//
// The admin Notifications page and the news "notify" toggle both end up here, so
// both resolve the audience the same way, leave the same PushCampaign record and
// audit entry, and report the same device count.

import { prisma } from "@astra/db";
import { audienceTokens, type PushAudience } from "./push-audience";
import { sendPushToTokens } from "./push";
import { writeAudit } from "./audit";

export class NoRecipientsError extends Error {
  constructor() {
    super("Nobody in that audience has notifications enabled, so nothing was sent.");
    this.name = "NoRecipientsError";
  }
}

export async function sendCampaign(params: {
  actorId: string;
  title: string;
  body: string;
  route?: string | null;
  audience: PushAudience;
  /** Extra payload for the app, e.g. { type: "news", id }. */
  data?: Record<string, unknown>;
}) {
  const { tokens, userCount } = await audienceTokens(params.audience);
  if (tokens.length === 0) throw new NoRecipientsError();

  const result = await sendPushToTokens(tokens, {
    title: params.title,
    body: params.body,
    // The app reads `route` to deep-link when the notification is tapped.
    data: { ...(params.data ?? {}), ...(params.route ? { route: params.route } : {}) },
  });

  const campaign = await prisma.pushCampaign.create({
    data: {
      title: params.title,
      body: params.body,
      route: params.route ?? null,
      filters: params.audience,
      sentCount: result.accepted,
      userCount,
      sentById: params.actorId,
    },
  });
  await writeAudit({
    actorId: params.actorId,
    action: "create",
    targetType: "PushCampaign",
    targetId: campaign.id,
    metadata: { title: params.title, accepted: result.accepted, failed: result.failed, devices: tokens.length },
  });
  return { campaign, devices: tokens.length, userCount, ...result };
}
