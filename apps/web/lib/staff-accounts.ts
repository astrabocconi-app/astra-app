// Backoffice staff accounts: username + password, with a per-page access list.
// SERVER-ONLY.
//
// These sit alongside the two logins that already exist and replace neither:
//
//   - the single central admin (env-configured, username + password + emailed
//     OTP) in lib/admin-auth.ts, which stays the way in for whoever holds the
//     env vars and is the only account that can reach Team and the Audit log;
//   - students, who sign in with a Bocconi email OTP and never see /admin.
//
// A staff account is an ordinary User row with staffUsername/staffPasswordHash
// set, the STAFF role, and dashboardPages listing what it may open. Keeping it
// on User rather than in a side table means sessions, the audit log and
// authz.ts all keep working with no special cases.

import crypto from "node:crypto";
import { prisma, Role } from "@astra/db";
import { hashPassword, verifyPassword } from "./partner";
import { ADMIN_ONLY_PAGES, ALL_PAGE_KEYS } from "./dashboard-pages";

/** Usernames are matched lowercase, so they are stored lowercase. */
export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$/;

export class StaffAccountError extends Error {}

export function validateUsername(username: string): string {
  const u = normaliseUsername(username);
  if (!USERNAME_RE.test(u)) {
    throw new StaffAccountError(
      "Username must be 3-32 characters: letters, numbers, dots, dashes or underscores.",
    );
  }
  return u;
}

export function validatePassword(password: string): string {
  // Length is the only rule worth enforcing. Composition rules push people
  // towards predictable substitutions without buying much.
  if (password.length < 10) {
    throw new StaffAccountError("Password must be at least 10 characters.");
  }
  if (password.length > 200) {
    throw new StaffAccountError("Password is too long.");
  }
  return password;
}

/**
 * Drop anything that is not a real page, and anything reserved for the central
 * admin, so a hand-crafted request cannot grant Team or Audit to a staff
 * account. The editor filters these out too; this is the check that counts.
 */
export function sanitisePages(pages: unknown): string[] {
  if (!Array.isArray(pages)) return [];
  const seen = new Set<string>();
  for (const p of pages) {
    if (typeof p !== "string") continue;
    if (!ALL_PAGE_KEYS.includes(p)) continue;
    if (ADMIN_ONLY_PAGES.has(p)) continue;
    seen.add(p);
  }
  return [...seen];
}

/** Everything a staff account can be granted: the "Admin" button's payload. */
export const GRANTABLE_PAGE_KEYS: string[] = ALL_PAGE_KEYS.filter(
  (k) => !ADMIN_ONLY_PAGES.has(k),
);

export interface StaffAccount {
  id: string;
  username: string;
  name: string | null;
  email: string;
  pages: string[];
  createdAt: Date;
  lastSignInAt: Date | null;
}

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  const rows = await prisma.user.findMany({
    where: { staffUsername: { not: null }, deletedAt: null },
    select: {
      id: true,
      staffUsername: true,
      name: true,
      email: true,
      dashboardPages: true,
      createdAt: true,
      sessions: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    username: r.staffUsername!,
    name: r.name,
    email: r.email,
    pages: r.dashboardPages,
    createdAt: r.createdAt,
    // Best effort: Better Auth prunes expired sessions, so a long-idle account
    // reads as "never". Shown as a hint, never used for a decision.
    lastSignInAt: r.sessions[0]?.createdAt ?? null,
  }));
}

/**
 * Staff accounts need a User.email because the column is unique and required,
 * but they do not sign in with it and no mail is ever sent there. A synthetic
 * address on a reserved-by-RFC domain makes that unambiguous and guarantees it
 * can never collide with a real Bocconi address.
 */
function staffEmail(username: string): string {
  return `${username}@staff.astrabocconi.invalid`;
}

export async function createStaffAccount(input: {
  username: string;
  password: string;
  name?: string | null;
  pages: unknown;
}): Promise<StaffAccount> {
  const username = validateUsername(input.username);
  validatePassword(input.password);
  const pages = sanitisePages(input.pages);

  // Both columns are unique, and the email is derived from the username, so a
  // clash on either means the same thing. Checked here so the person sees a
  // sentence rather than a Prisma constraint error.
  const clash = await prisma.user.findFirst({
    where: { OR: [{ staffUsername: username }, { email: staffEmail(username) }] },
    select: { id: true },
  });
  if (clash) throw new StaffAccountError("That username is already taken.");

  const user = await prisma.user.create({
    data: {
      email: staffEmail(username),
      name: input.name?.trim() || username,
      roles: [Role.STAFF],
      emailVerified: true,
      staffUsername: username,
      staffPasswordHash: hashPassword(input.password),
      dashboardPages: pages,
    },
    select: { id: true, staffUsername: true, name: true, email: true, dashboardPages: true, createdAt: true },
  });

  return {
    id: user.id,
    username: user.staffUsername!,
    name: user.name,
    email: user.email,
    pages: user.dashboardPages,
    createdAt: user.createdAt,
    lastSignInAt: null,
  };
}

/** Replace an account's page list. Pass the full set, not a delta. */
export async function setStaffPages(userId: string, pages: unknown): Promise<string[]> {
  const account = await requireStaffAccount(userId);
  const next = sanitisePages(pages);
  await prisma.user.update({ where: { id: account.id }, data: { dashboardPages: next } });
  return next;
}

export async function setStaffPassword(userId: string, password: string): Promise<void> {
  const account = await requireStaffAccount(userId);
  validatePassword(password);
  await prisma.user.update({
    where: { id: account.id },
    data: { staffPasswordHash: hashPassword(password) },
  });
  // Signing out everywhere is the point of a password change: a stolen session
  // would otherwise outlive the password it was obtained with.
  await prisma.session.deleteMany({ where: { userId: account.id } });
}

export async function setStaffName(userId: string, name: string | null): Promise<void> {
  const account = await requireStaffAccount(userId);
  await prisma.user.update({
    where: { id: account.id },
    data: { name: name?.trim() || account.staffUsername },
  });
}

/**
 * Revoke an account: it can no longer sign in and vanishes from the Team list.
 *
 * The row is kept rather than deleted because AuditLog.actor is a nullable FK,
 * so deleting the user would null out the attribution on everything they ever
 * did — the entries would survive as "unknown", which is the opposite of what
 * an audit log is for. The same goes for the news posts and push campaigns they
 * authored. Clearing the credentials is what actually revokes access.
 *
 * staffUsername is released so the name can be handed to someone else — and so
 * is the synthetic email, which is derived from the username and unique, so
 * leaving it in place would block the reuse the released username implies.
 */
export async function revokeStaffAccount(userId: string): Promise<void> {
  const account = await requireStaffAccount(userId);
  await prisma.session.deleteMany({ where: { userId: account.id } });
  await prisma.user.update({
    where: { id: account.id },
    data: {
      staffUsername: null,
      staffPasswordHash: null,
      dashboardPages: [],
      roles: { set: [] },
      email: `revoked-${account.id}@staff.astrabocconi.invalid`,
      deletedAt: new Date(),
    },
  });
}

async function requireStaffAccount(userId: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, staffUsername: true, deletedAt: true },
  });
  // Guards every mutation above: without it, a stray id would let the Team page
  // rewrite a student's or the central admin's row.
  if (!account || !account.staffUsername || account.deletedAt) {
    throw new StaffAccountError("No such staff account.");
  }
  return account;
}

/**
 * Verify a staff username + password, returning the user for session creation.
 *
 * Runs a throwaway scrypt when the username is unknown so a wrong username and
 * a wrong password take the same time, and returns the same null either way.
 */
export async function verifyStaffCredentials(username: string, password: string) {
  const u = normaliseUsername(username);
  const user = await prisma.user.findFirst({
    where: { staffUsername: u, deletedAt: null },
  });

  if (!user?.staffPasswordHash) {
    crypto.scryptSync(password, "no-such-account", 64);
    return null;
  }
  if (!verifyPassword(password, user.staffPasswordHash)) return null;

  // Better Auth's session cookie wants the whole user record, so the hash is
  // stripped here rather than narrowing the select above.
  const { staffPasswordHash: _hash, ...safe } = user;
  return { ...safe, name: safe.name ?? u };
}
