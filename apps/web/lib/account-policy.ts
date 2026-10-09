// Who may delete their account through the student flow. Pure, so it is testable.

/** Roles that mean "this is not an ordinary student account". */
const NON_STUDENT_ROLES = ["ADMIN", "STAFF", "PARTNER_MANAGER"];

/** Can this user be deleted through the student flow? Pure, so it is testable. */
export function deletionBlocker(user: { roles: readonly string[]; hasPartnerMembership: boolean }): string | null {
  if (user.hasPartnerMembership || user.roles.includes("PARTNER_MANAGER")) {
    // Partner logins are issued by ASTRA and shared by venue staff; letting one
    // member of staff delete the venue's account from a phone would take the
    // whole venue offline. Those are managed from the backoffice instead.
    return "Partner accounts are managed by ASTRA and can't be deleted from the app.";
  }
  if (user.roles.some((r) => NON_STUDENT_ROLES.includes(r))) {
    // Staff and admin accounts have their own lifecycle (Team page); anonymising
    // one here would leave its username reserved and vanish it without a trace.
    return "This isn't a student account. Staff accounts are managed from the Team page.";
  }
  return null;
}
