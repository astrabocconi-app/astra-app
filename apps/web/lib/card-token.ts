// Signed loyalty-card token embedded in the student's QR. SERVER-ONLY.
//
// token = base64url(payload) "." base64url(HMAC-SHA256(payload)) where payload
// is { uid, iat }. The venue scanner submits it; the server verifies the
// signature and extracts the user. For now the token is long-lived (demo);
// short rotation + nonce replay-block + cooldown are the Phase-5 follow-ups.

import crypto from "node:crypto";

const SECRET = process.env.CARD_TOKEN_HMAC_SECRET ?? "";
// Lenient window for the demo so a shown card keeps working; tighten later.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function hmac(input: string): string {
  return crypto.createHmac("sha256", SECRET).update(input).digest("base64url");
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
