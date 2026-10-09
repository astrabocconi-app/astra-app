// Pure rules for the cached loyalty-card token (no imports, so node:test can load it).
//
// The server honours a card token for 15 minutes from issue. The app treats one
// as usable for 10, which leaves a margin for the walk to the till, and never
// shows a token that belongs to a different account.

export const CARD_MAX_AGE_MS = 10 * 60_000;

export type CardCache = { uid: string; token: string; savedAt: number };

/** Anything that is not the current { uid, token, savedAt } shape is ignored (older builds stored a bare token). */
export function parseCardCache(raw: string | null | undefined): CardCache | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<CardCache> | null;
    if (v && typeof v.uid === "string" && typeof v.token === "string" && typeof v.savedAt === "number") {
      return { uid: v.uid, token: v.token, savedAt: v.savedAt };
    }
  } catch {
    // not JSON: a legacy bare token
  }
  return null;
}

export type CardView = { token: string; stale: boolean };

/**
 * What the card tab may show. `live` is a token fetched this session (its
 * fetch time is known exactly); `cache` is what the last session left on disk.
 * Returns null when there is nothing trustworthy: wrong account, no token.
 */
export function pickCardToken(
  live: { token: string; at: number } | null,
  cache: CardCache | null,
  uid: string | null,
  now: number,
): CardView | null {
  const source =
    live ?? (cache && uid && cache.uid === uid ? { token: cache.token, at: cache.savedAt } : null);
  if (!source) return null;
  const age = now - source.at;
  // A negative age means the phone clock moved; do not trust it either way.
  return { token: source.token, stale: age > CARD_MAX_AGE_MS || age < -60_000 };
}
