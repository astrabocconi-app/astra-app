// DB row → API response mappers for CMS content. SERVER-ONLY.
//
// `coverImageKey` / `imageKey` currently hold an image URL (a real storage key
// once Supabase is wired); we surface it as `imageUrl` on the wire.

import type { NewsItem, EventItem, RewardItem } from "@astra/shared";
import type { NewsPost, Event as EventRow, Reward } from "@astra/db";

export function toNewsItem(n: NewsPost): NewsItem {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    excerpt: n.excerpt,
    imageUrl: n.coverImageKey,
    published: n.published,
    pinned: n.pinned,
    publishedAt: n.publishedAt ? n.publishedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toEventItem(e: EventRow): EventItem {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    imageUrl: e.coverImageKey,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    externalTicketUrl: e.externalTicketUrl,
    published: e.published,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toRewardItem(r: Reward): RewardItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: r.imageKey,
    costPoints: r.costPoints,
    stock: r.stock,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
  };
}
