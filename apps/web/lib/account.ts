// Self-service account deletion. SERVER-ONLY.
//
// Required by App Store guideline 5.1.1(v): an app that creates accounts must
// let people delete them from inside the app, not just contact support.
//
// This anonymises rather than hard-deletes, because it has to. PointsLedgerEntry
// is append-only, enforced by the `ledger_no_update_delete` database trigger,
// and User -> PointsLedgerEntry is ON DELETE CASCADE — so a real DELETE of the
// user row makes Postgres try to cascade into the ledger, the trigger raises,
// and the whole transaction aborts. Rather than defeat the trigger that protects
// the points economy, we strip everything that identifies a person and leave the
// ledger rows attached to an anonymous shell.
//
// What that means in practice: after this runs, nothing personally identifying
// remains (no email, name, avatar, academic profile, device tokens, sessions or
// login credentials), the account can never be signed into again, and the
// address is freed so the same person could sign up fresh later.

import { prisma } from "@astra/db";

export class AccountDeletionError extends Error {}

export interface DeleteAccountResult {
  /** Rows removed, per table — surfaced so the caller can log what happened. */
  removed: Record<string, number>;
}

/**
 * Partner logins are issued by ASTRA and shared by venue staff; letting one
 * member of staff delete the venue's account from a phone would take the whole
 * venue offline. Those are managed from the backoffice instead.
 */
export async function deleteOwnAccount(userId: string): Promise<DeleteAccountResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { partnerMembership: true },
  });
  if (!user) throw new AccountDeletionError("Account not found.");
  if (user.partnerMembership) {
    throw new AccountDeletionError(
      "Partner accounts are managed by ASTRA and can't be deleted from the app.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const removed: Record<string, number> = {};
    const drop = async (label: string, run: Promise<{ count: number }>) => {
      removed[label] = (await run).count;
    };

    // Credentials and anything that could let them back in.
    await drop("sessions", tx.session.deleteMany({ where: { userId } }));
    await drop("accounts", tx.account.deleteMany({ where: { userId } }));
    // Devices we could still push to.
    await drop("pushTokens", tx.pushToken.deleteMany({ where: { userId } }));
    // Personal profile and activity.
    await drop(
      "academicProfile",
      tx.studentAcademicProfile.deleteMany({ where: { userId } }),
    );
    await drop("consents", tx.consent.deleteMany({ where: { userId } }));
    await drop("rsvps", tx.rsvp.deleteMany({ where: { userId } }));
    await drop("tickets", tx.ticket.deleteMany({ where: { userId } }));
    await drop("materialAccesses", tx.materialAccess.deleteMany({ where: { userId } }));
    await drop("discountUsages", tx.discountUsage.deleteMany({ where: { userId } }));
    await drop("areaMemberships", tx.areaMembership.deleteMany({ where: { userId } }));

    // Scrub the user row itself. The email is rewritten (not blanked) because
    // it is UNIQUE and NOT NULL, and rewriting frees the real address so the
    // same person can sign up again later if they want to.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        emailVerified: false,
        name: null,
        image: null,
        deletedAt: new Date(),
      },
    });

    return { removed };
  });
}
