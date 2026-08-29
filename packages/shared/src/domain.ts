// Domain constants shared by mobile + web. Single source of truth so the
// client-side check and the server-side guard can't drift apart.

/** Email domains allowed to sign in (Bocconi students + university). */
export const ALLOWED_EMAIL_DOMAINS = ["studbocconi.it", "unibocconi.it"] as const;

/** True if `email`'s domain is in ALLOWED_EMAIL_DOMAINS (case-insensitive). */
export function isAllowedEmail(email: string): boolean {
  const domain = email.trim().split("@")[1]?.toLowerCase();
  return !!domain && (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

/**
 * DEV-ONLY bypass usernames. Typing one of these skips the OTP flow entirely.
 * The server honours it ONLY on non-production (local) API instances, and the
 * mobile client only offers it in dev builds (`__DEV__`). NOT a production path.
 */
export const DEV_LOGIN_USERNAMES = ["blabmerda"] as const;

export function isDevLoginUsername(input: string): boolean {
  return (DEV_LOGIN_USERNAMES as readonly string[]).includes(input.trim().toLowerCase());
}

/**
 * Centre of the Bocconi grounds — the midpoint of the historic Sarfatti block
 * and the Nuovo Campus, derived from the real OSM footprint (see the mobile
 * app's lib/campus-geo.ts). The Discounts map opens centred here with the
 * campus highlighted, so partner pins are always read relative to it.
 */
export const BOCCONI_CAMPUS = {
  name: "Università Bocconi",
  latitude: 45.4488,
  longitude: 9.1887,
} as const;
