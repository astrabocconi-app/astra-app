// Admin route guards. SERVER-ONLY.
//
// Every /api/admin/* handler starts with one of these, which resolves the
// session and enforces access (deny-by-default via lib/authz). Each returns
// either the session or a ready-made error response for the handler to return.
//
//   requireAdmin — the central admin only. For anything that changes who can do
//                  what, or that reads the audit trail.
//   requirePageApi(pageKey) — the admin, or a staff account granted that page.
//
// The dashboard page guard in lib/dashboard-access.ts hides the UI; this is
// what stops a granted-News account from POSTing to the rewards endpoint.

import type { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./session";
import { isAdmin } from "./authz";
import { allowedPageKeys, canAccessPage } from "./dashboard-access";
import { errorResponse } from "./api";

export async function requireAdmin(
  req: Request,
  requestId: string,
): Promise<{ session: SessionUser } | { error: NextResponse }> {
  const session = await getSessionUser(req.headers);
  if (!session) {
    return { error: errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId) };
  }
  if (!isAdmin(session.actor)) {
    return { error: errorResponse(403, "FORBIDDEN", "Admin access required.", requestId) };
  }
  return { session };
}

/**
 * Allow the admin, or any staff account with at least one page.
 *
 * For the endpoints shared by every editor — image upload above all. Gating
 * those on one particular page would break the News editor for someone who only
 * has Events, and they do not belong to a section of their own.
 */
export async function requireAnyPage(
  req: Request,
  requestId: string,
): Promise<{ session: SessionUser } | { error: NextResponse }> {
  const session = await getSessionUser(req.headers);
  if (!session) {
    return { error: errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId) };
  }
  if (allowedPageKeys(session).length === 0) {
    return { error: errorResponse(403, "FORBIDDEN", "No dashboard access.", requestId) };
  }
  return { session };
}

/** Allow the admin, or a staff account that has been granted `pageKey`. */
export async function requirePageApi(
  req: Request,
  requestId: string,
  pageKey: string,
): Promise<{ session: SessionUser } | { error: NextResponse }> {
  const session = await getSessionUser(req.headers);
  if (!session) {
    return { error: errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId) };
  }
  if (!canAccessPage(session, pageKey)) {
    return { error: errorResponse(403, "FORBIDDEN", "You do not have access to this section.", requestId) };
  }
  return { session };
}
