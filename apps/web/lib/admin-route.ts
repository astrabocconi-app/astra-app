// Admin route guard. SERVER-ONLY.
//
// ASTRA content is admin-only. Every /api/admin/* handler starts by calling
// requireAdmin, which resolves the session and enforces the ADMIN role
// (deny-by-default via lib/authz). Returns either the session or a ready-made
// error response for the handler to return.

import type { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./session";
import { isAdmin } from "./authz";
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
