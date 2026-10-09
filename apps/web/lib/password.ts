// Password hashing for venue logins, staff accounts and the admin. SERVER-ONLY.
//
// scrypt (salt:hash, both hex) via the ASYNC API: scryptSync takes ~50 ms of
// blocked event loop per call, and the login endpoints are unauthenticated, so
// a flood of wrong guesses would stall every other request on the instance.

import crypto from "node:crypto";

function scrypt(pw: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(pw, salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(pw, salt)).toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = await scrypt(pw, salt);
  const known = Buffer.from(hash, "hex");
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

/**
 * Spend the same time a real check would, for a login that does not exist, so a
 * wrong username and a wrong password are indistinguishable by timing.
 */
export async function burnPasswordCheck(pw: string): Promise<void> {
  await scrypt(pw, "no-such-account");
}
