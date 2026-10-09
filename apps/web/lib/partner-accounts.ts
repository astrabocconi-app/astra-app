// Partner login accounts. SERVER-ONLY.
//
// A venue can have several logins (front desk, bar, an events team). Each is a
// PartnerMembership tied to its own User carrying the PARTNER_MANAGER role, so
// scans are attributable to the specific account that made them.
//
// Accounts are NOT students: they never sign in with an email OTP, so their
// User rows exist purely to hang the session and the ledger's grantedById off.
// The synthetic email keeps that row unique without implying a real inbox.

import { prisma, Role, type Prisma } from "@astra/db";
import { hashPassword } from "./password";

/** Login codes are typed by staff on a phone: lowercase, no spaces. */
export function normaliseLoginCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Not a deliverable address — partner accounts have no inbox. Derived from the
 * login code so the User row has the unique email the schema requires.
 */
export function syntheticEmail(loginCode: string): string {
  return `${normaliseLoginCode(loginCode)}@partner.astra.local`;
}

export interface PartnerAccountInput {
  partnerId: string;
  loginCode: string;
  password: string;
  label?: string | null;
  scanOnly?: boolean;
}

/**
 * Is this login code unusable? Checked against memberships AND users: the User
 * row's synthetic email is unique too, and a revoked login used to keep its
 * address, so re-creating the same code failed with a raw constraint error.
 */
async function codeTaken(loginCode: string): Promise<boolean> {
  const [membership, user] = await Promise.all([
    prisma.partnerMembership.findUnique({ where: { loginCode }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: syntheticEmail(loginCode) }, select: { id: true } }),
  ]);
  return Boolean(membership || user);
}

/** Create a login for a venue. Throws if the code is taken. */
export async function createPartnerAccount(input: PartnerAccountInput) {
  const loginCode = normaliseLoginCode(input.loginCode);

  if (await codeTaken(loginCode)) throw new Error(`The login code "${loginCode}" is already in use.`);

  const partner = await prisma.partner.findFirst({
    where: { id: input.partnerId, deletedAt: null },
  });
  if (!partner) throw new Error("Partner not found.");

  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: syntheticEmail(loginCode),
        name: input.label?.trim() || partner.name,
        emailVerified: true,
        roles: [Role.PARTNER_MANAGER],
      },
    });
    return tx.partnerMembership.create({
      data: {
        userId: user.id,
        partnerId: partner.id,
        loginCode,
        passwordHash,
        label: input.label?.trim() || null,
        scanOnly: input.scanOnly ?? false,
      },
      include: { partner: true },
    });
  });
}

/** Update a login. Password and code are optional — only set what changed. */
export async function updatePartnerAccount(
  id: string,
  patch: { loginCode?: string; password?: string; label?: string | null; scanOnly?: boolean },
) {
  const existing = await prisma.partnerMembership.findUnique({ where: { id } });
  if (!existing) throw new Error("Account not found.");

  const loginCode = patch.loginCode ? normaliseLoginCode(patch.loginCode) : undefined;
  if (loginCode && loginCode !== existing.loginCode && (await codeTaken(loginCode))) {
    throw new Error(`The login code "${loginCode}" is already in use.`);
  }

  const passwordHash = patch.password ? await hashPassword(patch.password) : undefined;
  return prisma.$transaction(async (tx) => {
    const membership = await tx.partnerMembership.update({
      where: { id },
      data: {
        ...(loginCode ? { loginCode } : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(patch.label !== undefined ? { label: patch.label?.trim() || null } : {}),
        ...(patch.scanOnly !== undefined ? { scanOnly: patch.scanOnly } : {}),
      },
      include: { partner: true },
    });
    // A reset password signs the venue's phones out: a lost or stolen scanner
    // must stop working the moment the password changes, like a staff reset.
    if (passwordHash) await tx.session.deleteMany({ where: { userId: membership.userId } });
    // Keep the User row in step so sessions and the audit trail stay readable.
    await tx.user.update({
      where: { id: membership.userId },
      data: {
        ...(loginCode ? { email: syntheticEmail(loginCode) } : {}),
        ...(patch.label !== undefined
          ? { name: patch.label?.trim() || membership.partner.name }
          : {}),
      },
    });
    return membership;
  });
}

/**
 * Rewrite a revoked login's address so the code can be issued again: the synthetic
 * email is unique, and the soft-deleted row would otherwise keep it forever.
 */
const revokedEmail = (userId: string) => `revoked-${userId}@partner.astra.local`;

/**
 * Remove a login.
 *
 * The User row is soft-deleted rather than dropped: PointsLedgerEntry
 * references it as grantedById, so deleting it outright would break the record
 * of who awarded past scans. Clearing the membership is enough to stop the
 * login working, and its sessions go with it.
 */
export async function deletePartnerAccount(id: string) {
  const existing = await prisma.partnerMembership.findUnique({ where: { id } });
  if (!existing) throw new Error("Account not found.");

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: existing.userId } }),
    prisma.partnerMembership.delete({ where: { id } }),
    prisma.user.update({
      where: { id: existing.userId },
      data: { deletedAt: new Date(), email: revokedEmail(existing.userId) },
    }),
  ]);
}

/** Sign every login of a venue out (the venue was hidden): they cannot award points meanwhile either way. */
export async function endVenueSessions(tx: Prisma.TransactionClient, partnerId: string): Promise<number> {
  const rows = await tx.partnerMembership.findMany({ where: { partnerId }, select: { userId: true } });
  if (rows.length === 0) return 0;
  const res = await tx.session.deleteMany({ where: { userId: { in: rows.map((r) => r.userId) } } });
  return res.count;
}

/**
 * Revoke every login of a venue that is being deleted: sessions, memberships,
 * and the users (soft-deleted, address freed). Without this the venue's staff
 * could keep signing in and awarding points after the partnership ended.
 */
export async function revokeVenueLogins(tx: Prisma.TransactionClient, partnerId: string): Promise<number> {
  const rows = await tx.partnerMembership.findMany({ where: { partnerId }, select: { userId: true } });
  for (const { userId } of rows) {
    await tx.session.deleteMany({ where: { userId } });
    await tx.partnerMembership.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date(), email: revokedEmail(userId) } });
  }
  return rows.length;
}
