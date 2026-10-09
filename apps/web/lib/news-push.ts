// "Notify students" on a news post. SERVER-ONLY.
//
// Goes through the same campaign path as the Notifications page: students only,
// a PushCampaign row, an audit entry, a device count. Saving a post never
// notifies by itself, and a post that already went out is not sent again unless
// someone explicitly asks (`notifyAgain`).

import { prisma } from "@astra/db";
import { sendCampaign, NoRecipientsError } from "./push-campaign";
import { shouldNotify } from "./news-push-policy";
import { log, newRequestId, describeError } from "./api";

export interface NotifyResult {
  sent: boolean;
  /** Why not, when `sent` is false. */
  reason?: "already_sent" | "no_recipients" | "failed";
  devices?: number;
}

export { shouldNotify };

export async function notifyNewsPost(
  post: { id: string; title: string; body: string; excerpt: string | null },
  actorId: string,
): Promise<NotifyResult> {
  try {
    const sent = await sendCampaign({
      actorId,
      title: post.title.slice(0, 80),
      // A blank summary falls back to the start of the article, never an empty body.
      body: (post.excerpt?.trim() || post.body.slice(0, 140)).slice(0, 300),
      audience: { roles: ["STUDENT"] },
      data: { type: "news", id: post.id },
      // The tap opens the article in builds that know item routes; older ones
      // ignore an unknown route and just open the app.
      route: `/news/${post.id}`,
    });
    await prisma.newsPost.update({ where: { id: post.id }, data: { pushedAt: new Date() } });
    return { sent: true, devices: sent.devices };
  } catch (e) {
    if (e instanceof NoRecipientsError) return { sent: false, reason: "no_recipients" };
    log("error", newRequestId(), "news notification failed", { error: describeError(e) });
    return { sent: false, reason: "failed" };
  }
}
