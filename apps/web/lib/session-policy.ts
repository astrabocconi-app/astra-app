// Session lifetime rules. Pure, so the tests can import them without Better Auth.

/**
 * Backoffice sessions (admin and staff) die this long after sign-in, however
 * actively they are used. Students stay signed in on a rolling 180 days (see
 * lib/auth.ts); a stolen dashboard cookie must not be good for months.
 */
export const BACKOFFICE_SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const BACKOFFICE_ROLES = ["ADMIN", "STAFF", "AREA_MANAGER"];

/** Has a backoffice session outlived its absolute lifetime? Pure, so it is testable. */
export function backofficeSessionExpired(
  roles: readonly string[],
  createdAt: Date | string | number,
  now: number = Date.now(),
): boolean {
  if (!roles.some((r) => BACKOFFICE_ROLES.includes(r))) return false;
  return now - new Date(createdAt).getTime() > BACKOFFICE_SESSION_MAX_AGE_MS;
}

