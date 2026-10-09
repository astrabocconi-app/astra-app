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
import { verifyPassword, burnPasswordCheck } from "./password";
import { writeAudit } from "./audit";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
// One admin → one pending OTP at a time, keyed on this fixed identifier in the
// Better Auth Verification table.
const OTP_IDENTIFIER = "admin-2fa";

// OTP second factor: ON in production, OFF locally (so it's usable without an
// inbox during dev). Override explicitly with ADMIN_2FA_ENABLED=true|false.
export function admin2faEnabled(): boolean {
  if (process.env.ADMIN_2FA_ENABLED != null) {
    return process.env.ADMIN_2FA_ENABLED === "true";
  }
  return process.env.NODE_ENV === "production";
}

export function adminConfigured(): boolean {
  return Boolean(
    ADMIN_USERNAME &&
      ADMIN_EMAIL &&
      ADMIN_PASSWORD_HASH &&
      ![ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD_HASH].some((v) => v!.includes("PLACEHOLDER")),
  );
}

/**
 * Username check + scrypt password verify (async, so a flood of guesses cannot
 * stall the event loop). A wrong username still spends a scrypt, so it is not
 * distinguishable from a wrong password by timing.
 */
export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (!adminConfigured()) return false;
  if (username.trim().toLowerCase() !== ADMIN_USERNAME!.trim().toLowerCase()) {
    await burnPasswordCheck(password);
    return false;
  }
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

/**
 * Ensure the admin User row exists with the ADMIN role, and return it.
 *
 * ADMIN_EMAIL names THE one admin. Any other account holding the ADMIN role (a
 * previous admin address, a dev-login account that was once created against the
 * live database) is demoted and signed out here: isAdmin() only looks at the
 * role, so a leftover row is a full-power credential nobody is watching.
 */
export async function upsertAdminUser() {
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL! },
    update: { roles: { set: [Role.ADMIN] }, emailVerified: true, deletedAt: null },
    create: {
      email: ADMIN_EMAIL!,
      name: "ASTRA Admin",
      roles: [Role.ADMIN],
      emailVerified: true,
    },
  });

  const others = await prisma.user.findMany({
    where: { roles: { has: Role.ADMIN }, id: { not: user.id } },
    select: { id: true },
  });
  if (others.length > 0) {
    const ids = others.map((o) => o.id);
    await prisma.$transaction([
      prisma.user.updateMany({ where: { id: { in: ids } }, data: { roles: { set: [Role.STUDENT] } } }),
      prisma.session.deleteMany({ where: { userId: { in: ids } } }),
    ]);
    await writeAudit({
      actorId: user.id,
      action: "auth.demote_admin",
      targetType: "User",
      targetId: user.id,
      metadata: { demoted: ids.length },
    });
  }
  return user;
}
