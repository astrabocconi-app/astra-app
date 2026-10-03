// Profile pictures: DiceBear "adventurer-neutral" avatars, chosen by seed.
//
// The seed lives in the user's `image` field as "dicebear:<seed>". Without one,
// the user id is the seed — so every account has its own avatar from day one,
// and changing it just means picking another seed.

export const AVATAR_PREFIX = "dicebear:";
/** What a client may send as a seed: short and URL-safe. */
export const AVATAR_SEED_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function avatarSeed(userId: string, image: string | null | undefined): string {
  return image?.startsWith(AVATAR_PREFIX) ? image.slice(AVATAR_PREFIX.length) : userId;
}

/** PNG, since React Native's Image can't draw SVG. */
export function avatarUrl(seed: string, size = 128): string {
  return `https://api.dicebear.com/10.x/adventurer-neutral/png?seed=${encodeURIComponent(seed)}&size=${size}`;
}
