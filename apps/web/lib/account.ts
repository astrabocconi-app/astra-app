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
// remains (no email, name, avatar, academic profile, grades, support messages,
// device tokens, sessions, login credentials or live Eventbrite discount codes)
// and the account can never be signed into again. The one thing kept is an HMAC
// of the email on the shell: the address is free to sign up again, but that
// person does not get a second welcome bonus or a fresh per-person reward limit.

import { prisma } from "@astra/db";
import { emailHash } from "./email-hash";
import { revokeDiscounts } from "./eventbrite-revoke";
import { deletionBlocker } from "./account-policy";

export class AccountDeletionError extends Error {}

export interface DeleteAccountResult {
  /** Rows removed, per table — surfaced so the caller can log what happened. */
  removed: Record<string, number>;
}

export async function deleteOwnAccount(userId: string): Promise<DeleteAccountResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { partnerMembership: true },
  });
  if (!user) throw new AccountDeletionError("Account not found.");
  const blocker = deletionBlocker({ roles: user.roles, hasPartnerMembership: Boolean(user.partnerMembership) });
  if (blocker) throw new AccountDeletionError(blocker);

  // The discount ids have to be known before the rows that hold them go.
  const discounts = await prisma.eventAppDiscount.findMany({
    where: { userId, eventbriteDiscountId: { not: "" } },
    select: { eventbriteDiscountId: true },
  });
  const tombstone = emailHash(user.email);

  const result = await prisma.$transaction(async (tx) => {
    const removed: Record<string, number> = {};
    const drop = async (label: string, run: Promise<{ count: number }>) => {
      removed[label] = (await run).count;
    };

    // Credentials and anything that could let them back in.
    await drop("sessions", tx.session.deleteMany({ where: { userId } }));
    await drop("accounts", tx.account.deleteMany({ where: { userId } }));
    // Pending sign-in codes are keyed by the address; they would otherwise
    // outlive the account for their ten-minute life.
    await drop("verifications", tx.verification.deleteMany({ where: { identifier: { contains: user.email } } }));
    // Devices we could still push to.
    await drop("pushTokens", tx.pushToken.deleteMany({ where: { userId } }));
    // Personal profile and activity.
    await drop(
      "academicProfile",
      tx.studentAcademicProfile.deleteMany({ where: { userId } }),
    );
    await drop("examRecords", tx.examRecord.deleteMany({ where: { userId } }));
    // Free text the student typed: it can contain names, numbers, circumstances.
    await drop("supportMessages", tx.supportMessage.deleteMany({ where: { userId } }));
    await drop("consents", tx.consent.deleteMany({ where: { userId } }));
    await drop("rsvps", tx.rsvp.deleteMany({ where: { userId } }));
    await drop("tickets", tx.ticket.deleteMany({ where: { userId } }));
    await drop("eventAppDiscounts", tx.eventAppDiscount.deleteMany({ where: { userId } }));
    await drop("materialAccesses", tx.materialAccess.deleteMany({ where: { userId } }));
    await drop("discountUsages", tx.discountUsage.deleteMany({ where: { userId } }));
    await drop("areaMemberships", tx.areaMembership.deleteMany({ where: { userId } }));

    // The codes live on Eventbrite, not here: queue every one for revocation in
    // the same transaction, so a crash right after commit cannot lose them.
    await tx.eventbriteRevocation.createMany({
      data: discounts.map((d) => ({ discountId: d.eventbriteDiscountId })),
      skipDuplicates: true,
    });

    // Scrub the user row itself. The email is rewritten (not blanked) because
    // it is UNIQUE and NOT NULL, and rewriting frees the real address so the
    // same person can sign up again later if they want to — carrying the
    // tombstone, so that does not reset what the account had already used.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        emailVerified: false,
        name: null,
        image: null,
        emailHash: tombstone,
        deletedAt: new Date(),
      },
    });

    return { removed };
  });

  // Best-effort and time-boxed: whatever Eventbrite does not confirm stays queued
  // for the daily cron, so the student's personal discount codes stop working
  // either way.
  const revocation = await revokeDiscounts(discounts.map((d) => d.eventbriteDiscountId));
  return { removed: { ...result.removed, eventbriteRevoked: revocation.revoked, eventbritePending: revocation.pending } };
}
