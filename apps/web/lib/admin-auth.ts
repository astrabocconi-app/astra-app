// Single-admin 2FA login. SERVER-ONLY.
//
// ASTRA has ONE central admin account that controls all content. It signs in
// with username + password (stored as env, never in the DB) and then a 6-digit
// OTP emailed via the existing SMTP transport — i.e. two factors. This is fully
// separate from the student email-OTP flow and the partner code+password flow.
//
// Setup: run `node scripts/create-admin.mjs <username> <email> [password]` to
// generate the three env vars below, then set them on the web app (and Vercel).
//
//   ADMIN_USERNAME       — the login username
//   ADMIN_EMAIL          — where the OTP is sent; also the admin User's email
//   ADMIN_PASSWORD_HASH  — scrypt hash (salt:hash) of the password

import crypto from "node:crypto";
import { prisma, Role } from "@astra/db";
import { verifyPassword } from "./partner";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
// One admin → one pending OTP at a time, keyed on this fixed identifier in the
// Better Auth Verification table.
const OTP_IDENTIFIER = "admin-2fa";

export function adminConfigured(): boolean {
  return Boolean(
    ADMIN_USERNAME &&
      ADMIN_EMAIL &&
      ADMIN_PASSWORD_HASH &&
      ![ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD_HASH].some((v) => v!.includes("PLACEHOLDER")),
  );
}

/** Constant-time-ish username check + scrypt password verify. */
export function verifyAdminCredentials(username: string, password: string): boolean {
  if (!adminConfigured()) return false;
  if (username.trim().toLowerCase() !== ADMIN_USERNAME!.trim().toLowerCase()) return false;
  return verifyPassword(password, ADMIN_PASSWORD_HASH!);
}

export function adminEmail(): string {
  return ADMIN_EMAIL!;
}

/** name@host → n•••@host (for a "code sent to …" hint without leaking the address). */
export function maskEmail(email: string): string {
  const [local, host] = email.split("@");
  if (!local || !host) return "your email";
  const shown = local.slice(0, 1);
  return `${shown}${"•".repeat(Math.max(1, local.length - 1))}@${host}`;
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Store the (hashed) pending OTP, replacing any previous one. */
export async function storeAdminOtp(otp: string): Promise<void> {
  await prisma.verification.deleteMany({ where: { identifier: OTP_IDENTIFIER } });
  await prisma.verification.create({
    data: {
      id: crypto.randomUUID(),
      identifier: OTP_IDENTIFIER,
      value: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
}

/** Verify + single-use consume the pending OTP. */
export async function consumeAdminOtp(otp: string): Promise<boolean> {
  const rec = await prisma.verification.findFirst({
    where: { identifier: OTP_IDENTIFIER },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return false;
  if (rec.expiresAt < new Date()) {
    await prisma.verification.deleteMany({ where: { identifier: OTP_IDENTIFIER } });
    return false;
  }
  const expected = Buffer.from(rec.value);
  const got = Buffer.from(hashOtp(otp));
  const ok = expected.length === got.length && crypto.timingSafeEqual(expected, got);
  if (ok) await prisma.verification.deleteMany({ where: { identifier: OTP_IDENTIFIER } });
  return ok;
}

/** Ensure the admin User row exists with the ADMIN role, and return it. */
export async function upsertAdminUser() {
  return prisma.user.upsert({
    where: { email: ADMIN_EMAIL! },
    update: { roles: { set: [Role.ADMIN] }, emailVerified: true, deletedAt: null },
    create: {
      email: ADMIN_EMAIL!,
      name: "ASTRA Admin",
      roles: [Role.ADMIN],
      emailVerified: true,
    },
  });
}
