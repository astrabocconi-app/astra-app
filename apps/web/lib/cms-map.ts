// DB row → API response mappers for CMS content. SERVER-ONLY.
//
// `coverImageKey` / `imageKey` hold either a pasted absolute URL or a relative
// media path (/api/media/:id) for images uploaded to our own store. When an
// `origin` is supplied (student/mobile read routes), relative paths are
// resolved to absolute so the client can load them directly; without it (the
// dashboard edit forms) the raw stored value is returned so re-saving is stable.

import type { NewsItem, EventItem, RewardItem } from "@astra/shared";
import type { NewsPost, Event as EventRow, Reward } from "@astra/db";

export function resolveImageUrl(value: string | null, origin?: string): string | null {
  if (!value) return null;
  if (origin && value.startsWith("/")) return origin + value;
  return value;
}

/** Absolute origin the request came in on (works for localhost, LAN IP, Vercel). */
export function originFromRequest(req: Request): string {
  const host = req.headers.get("host");
  // Vercel/proxies always set x-forwarded-proto (https in prod). Absent → a
  // direct dev connection over http (localhost or LAN IP).
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export function toNewsItem(n: NewsPost, origin?: string): NewsItem {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    excerpt: n.excerpt,
    imageUrl: resolveImageUrl(n.coverImageKey, origin),
    published: n.published,
    pinned: n.pinned,
    publishedAt: n.publishedAt ? n.publishedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toEventItem(e: EventRow, origin?: string): EventItem {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    imageUrl: resolveImageUrl(e.coverImageKey, origin),
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    externalTicketUrl: e.externalTicketUrl,
    published: e.published,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toRewardItem(r: Reward, origin?: string): RewardItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: resolveImageUrl(r.imageKey, origin),
    costPoints: r.costPoints,
    stock: r.stock,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
  };
}
