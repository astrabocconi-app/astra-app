// Domain constants shared by mobile + web. Single source of truth so the
// client-side check and the server-side guard can't drift apart.

/** Email domains allowed to sign in (Bocconi students + university). */
export const ALLOWED_EMAIL_DOMAINS = ["studbocconi.it", "unibocconi.it"] as const;

/** True if `email`'s domain is in ALLOWED_EMAIL_DOMAINS (case-insensitive). */
export function isAllowedEmail(email: string): boolean {
  const domain = email.trim().split("@")[1]?.toLowerCase();
  return !!domain && (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
