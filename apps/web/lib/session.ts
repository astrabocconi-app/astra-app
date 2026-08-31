// Resolve the authenticated actor from a request, for use in route handlers.
//
// SERVER-ONLY. The Actor (id + roles + areas) is what lib/authz.ts checks.

import { prisma } from "@astra/db";
import { auth } from "./auth";
import { type Actor, UnauthorizedError } from "./authz";

export interface SessionUser {
  actor: Actor;
  user: {
    id: string;
    email: string;
    name: string | null;
    roles: string[];
    /** Dashboard pages this account may open. Ignored for admins. */
    dashboardPages: string[];
    /** Set for backoffice staff accounts; null for students and the admin. */
    staffUsername: string | null;
  };
}

/** Resolve the current user + actor, or null if not authenticated. */
export async function getSessionUser(
  reqHeaders: Headers
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      roles: true,
      dashboardPages: true,
      staffUsername: true,
      deletedAt: true,
      areaMemberships: { select: { areaId: true } },
    },
  });
  if (!user || user.deletedAt) return null;

  return {
    actor: {
      userId: user.id,
      roles: user.roles,
      areaIds: user.areaMemberships.map((m) => m.areaId),
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      dashboardPages: user.dashboardPages,
      staffUsername: user.staffUsername,
    },
  };
}

/** Like getSessionUser but throws UnauthorizedError when not signed in. */
export async function requireSessionUser(reqHeaders: Headers): Promise<SessionUser> {
  const result = await getSessionUser(reqHeaders);
  if (!result) throw new UnauthorizedError();
  return result;
}
