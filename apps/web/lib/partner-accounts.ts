// Partner login accounts. SERVER-ONLY.
//
// A venue can have several logins (front desk, bar, an events team). Each is a
// PartnerMembership tied to its own User carrying the PARTNER_MANAGER role, so
// scans are attributable to the specific account that made them.
//
// Accounts are NOT students: they never sign in with an email OTP, so their
// User rows exist purely to hang the session and the ledger's grantedById off.
// The synthetic email keeps that row unique without implying a real inbox.

import { prisma, Role } from "@astra/db";
import { hashPassword } from "./partner";

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

/** Create a login for a venue. Throws if the code is taken. */
export async function createPartnerAccount(input: PartnerAccountInput) {
  const loginCode = normaliseLoginCode(input.loginCode);

  const clash = await prisma.partnerMembership.findUnique({ where: { loginCode } });
  if (clash) throw new Error(`The login code "${loginCode}" is already in use.`);

  const partner = await prisma.partner.findFirst({
    where: { id: input.partnerId, deletedAt: null },
  });
  if (!partner) throw new Error("Partner not found.");

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
        passwordHash: hashPassword(input.password),
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
  if (loginCode && loginCode !== existing.loginCode) {
    const clash = await prisma.partnerMembership.findUnique({ where: { loginCode } });
    if (clash) throw new Error(`The login code "${loginCode}" is already in use.`);
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.partnerMembership.update({
      where: { id },
      data: {
        ...(loginCode ? { loginCode } : {}),
        ...(patch.password ? { passwordHash: hashPassword(patch.password) } : {}),
        ...(patch.label !== undefined ? { label: patch.label?.trim() || null } : {}),
        ...(patch.scanOnly !== undefined ? { scanOnly: patch.scanOnly } : {}),
      },
      include: { partner: true },
    });
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
 * Remove a login.
 *
 * The User row is soft-deleted rather than dropped: PointsLedgerEntry
 * references it as grantedById, so deleting it outright would break the record
 * of who awarded past scans. Clearing the membership is enough to stop the
 * login working.
 */
export async function deletePartnerAccount(id: string) {
  const existing = await prisma.partnerMembership.findUnique({ where: { id } });
  if (!existing) throw new Error("Account not found.");

  await prisma.$transaction([
    prisma.partnerMembership.delete({ where: { id } }),
    prisma.user.update({ where: { id: existing.userId }, data: { deletedAt: new Date() } }),
  ]);
}
