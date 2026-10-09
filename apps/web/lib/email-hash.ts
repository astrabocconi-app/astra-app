// Tombstone of a deleted account's email. SERVER-ONLY.
//
// Account deletion scrubs the address, which also freed it for a brand-new
// sign-up: the welcome bonus and every per-person reward limit started over. An
// HMAC of the normalised address is kept on the anonymised shell instead. It
// cannot be reversed without the secret, yet lets the signup bonus and
// perUserLimit recognise "this person was here before".

import crypto from "node:crypto";

function secret(): string {
  const value =
    process.env.SIGNUP_TOMBSTONE_SECRET ||
    process.env.CARD_TOKEN_HMAC_SECRET ||
    process.env.BETTER_AUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("No secret available to hash emails (SIGNUP_TOMBSTONE_SECRET / CARD_TOKEN_HMAC_SECRET).");
  }
  return "dev-insecure-tombstone-secret";
}

/** Lowercased, trimmed, so "A@x.it " and "a@x.it" are the same person. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailHash(email: string): string {
  return crypto.createHmac("sha256", secret()).update(normaliseEmail(email)).digest("hex");
}
