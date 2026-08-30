// Signed loyalty-card token embedded in the student's QR. SERVER-ONLY.
//
// token = base64url(payload) "." base64url(HMAC-SHA256(payload)) where payload
// is { uid, iat }. The venue scanner submits it; the server verifies the
// signature and extracts the user.

import crypto from "node:crypto";

/**
 * Signing key. Empty is only tolerable in local development.
 *
 * This used to fall back to "" everywhere, which meant a missing env var in
 * production silently produced tokens signed with an empty key — forgeable by
 * anyone who knows the (open) payload format, and with no signal that anything
 * was wrong. Fail loudly instead, the same way OTP delivery does.
 */
function secret(): string {
  const value = process.env.CARD_TOKEN_HMAC_SECRET;
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CARD_TOKEN_HMAC_SECRET is not set. Refusing to sign or verify loyalty-card tokens with an empty key.",
    );
  }
  return "dev-insecure-card-token-secret";
}

/**
 * How long a card QR stays valid.
 *
 * The app draws a fresh code every 60s, but that alone protected nothing while
 * old codes stayed valid for a day — a screenshot sent to a friend worked all
 * afternoon. Fifteen minutes makes a shared screenshot useless quickly while
 * still tolerating a student whose phone briefly lost signal on the way in
 * (the card is cached for offline display, so the token in hand may be a few
 * minutes old).
 *
 * Note this is a validity window, not a replay block: within it, the same code
 * can be presented more than once. Repeat awards are prevented separately by
 * the per-offer cooldown in lib/partner.ts, which is keyed on the student
 * rather than the code and so survives rotation.
 */
const MAX_AGE_MS = 15 * 60 * 1000;

function hmac(input: string): string {
  return crypto.createHmac("sha256", secret()).update(input).digest("base64url");
}

export function signCardToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString(
    "base64url",
  );
  return `${payload}.${hmac(payload)}`;
}

export function verifyCardToken(token: string): { userId: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { uid, iat } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof uid !== "string" || typeof iat !== "number") return null;
    if (Date.now() - iat > MAX_AGE_MS) return null;
    return { userId: uid };
  } catch {
    return null;
  }
}
