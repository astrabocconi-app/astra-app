// Profile pictures: DiceBear "adventurer-neutral" avatars, chosen by seed.
//
// The seed lives in the user's `image` field as "dicebear:<seed>". Without one
// the server derives a default (never the raw user id: seeds travel in URLs and
// logs). The picture itself is rendered by ASTRA's own API, which caches it, so
// phones never talk to a third party.

export const AVATAR_PREFIX = "dicebear:";
/** What a client may send as a seed: short and URL-safe. */
export const AVATAR_SEED_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function avatarSeed(userId: string, image: string | null | undefined): string {
  return image?.startsWith(AVATAR_PREFIX) ? image.slice(AVATAR_PREFIX.length) : userId;
}

/**
 * PNG, since React Native's Image can't draw SVG. Served by the API at
 * `GET /api/avatar/<seed>?size=N`; `apiBaseUrl` is the same base the API client uses.
 */
export function avatarUrl(apiBaseUrl: string, seed: string, size = 128): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  return `${base}/api/avatar/${encodeURIComponent(seed)}?size=${Math.round(size)}`;
}
